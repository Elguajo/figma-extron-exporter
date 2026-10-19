using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ExtronExporter.Adapter;

/// <summary>A refusal with a stable code, for diagnostics and tests.</summary>
public sealed class AdapterException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed record AdapterOptions(string InstallDir, string PowerShellPath, string HostScript, TimeSpan Timeout)
{
    public const string GuiDesignerVersion = "1.28.0.7";

    public static AdapterOptions Default(string? installDir = null) => new(
        installDir ?? Environment.GetEnvironmentVariable("EXTRON_GUI_DESIGNER_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Extron", "GUI Designer"),
        // SysWOW64 holds the 32-bit Windows PowerShell 5.1 on 64-bit Windows.
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe"),
        Path.Combine(AppContext.BaseDirectory, "host", "ExtronAdapterHost.ps1"),
        TimeSpan.FromMinutes(10));
}

public sealed record AdapterRun(JsonObject Result, byte[] Output, string HostOutput);

/// <summary>
/// Process boundary to the installed GUI Designer. Our .NET 10 process never loads Extron assemblies or
/// BinaryFormatter: it hands one allow-listed payload to a separate 32-bit Windows PowerShell 5.1 host and
/// gets back a new payload, which callers verify with the independent NRBF reader.
/// </summary>
public sealed class ExtronAdapter(AdapterOptions options)
{
    public static readonly JsonSerializerOptions RequestJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        // The host runs under Set-StrictMode: every property must be present, null included.
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public AdapterOptions Options { get; } = options;

    /// <summary>Fail before starting anything when a required component is absent.</summary>
    public void CheckEnvironment()
    {
        if (!OperatingSystem.IsWindows()) throw new AdapterException("host-missing", "The Extron adapter requires Windows.");
        if (!File.Exists(Options.PowerShellPath))
            throw new AdapterException("host-missing", $"32-bit Windows PowerShell 5.1 not found at {Options.PowerShellPath}.");
        if (!File.Exists(Options.HostScript)) throw new AdapterException("host-missing", $"Adapter host script not found at {Options.HostScript}.");
        string exe = Path.Combine(Options.InstallDir, "GUI Designer.exe");
        if (!File.Exists(exe))
            throw new AdapterException("extron-missing", $"Extron GUI Designer not found at {Options.InstallDir}. Install GUI Designer {AdapterOptions.GuiDesignerVersion} or pass --extron-dir.");
        string? version = FileVersionInfo.GetVersionInfo(exe).FileVersion;
        if (version != AdapterOptions.GuiDesignerVersion)
            throw new AdapterException("extron-version", $"GUI Designer {version} is installed; this adapter is verified only with {AdapterOptions.GuiDesignerVersion}.");
    }

    /// <summary>Run one operation on one payload. The payload must already be allow-listed by the caller.</summary>
    public AdapterRun Run(string operation, byte[] payload, string sectionName, object section)
    {
        CheckEnvironment();
        string work = Path.Combine(Path.GetTempPath(), "extron-adapter", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);
        try
        {
            string payloadPath = Path.Combine(work, "donor.ProjectGCP"), outputPath = Path.Combine(work, "output.ProjectGCP");
            string resultPath = Path.Combine(work, "result.json"), requestPath = Path.Combine(work, "request.json");
            File.WriteAllBytes(payloadPath, payload);
            var request = new JsonObject
            {
                ["protocol"] = "extron-adapter/1",
                ["operation"] = operation,
                ["installDir"] = Options.InstallDir,
                ["guiDesignerVersion"] = AdapterOptions.GuiDesignerVersion,
                ["payloadPath"] = payloadPath,
                ["payloadSha256"] = Convert.ToHexString(SHA256.HashData(payload)),
                ["outputPath"] = outputPath,
                ["resultPath"] = resultPath,
                [sectionName] = JsonSerializer.SerializeToNode(section, section.GetType(), RequestJson)
            };
            File.WriteAllText(requestPath, request.ToJsonString(RequestJson));

            var start = new ProcessStartInfo(Options.PowerShellPath)
            {
                UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true,
                WorkingDirectory = work
            };
            foreach (var a in new[] { "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", Options.HostScript, "-Request", requestPath })
                start.ArgumentList.Add(a);
            using var process = Process.Start(start) ?? throw new AdapterException("host-missing", "Could not start the adapter host.");
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            if (!process.WaitForExit(Options.Timeout))
            {
                process.Kill(entireProcessTree: true);
                throw new AdapterException("host-timeout", $"Adapter host did not finish within {Options.Timeout.TotalMinutes} min.");
            }
            string hostOutput = (stdout.Result + stderr.Result).Trim();
            if (!File.Exists(resultPath))
                throw new AdapterException("host-failed", $"Adapter host exited with {process.ExitCode} without a result. Output: {hostOutput}");
            var result = JsonNode.Parse(File.ReadAllText(resultPath))?.AsObject() ?? throw new AdapterException("host-failed", "Empty adapter result.");
            if (result["ok"]?.GetValue<bool>() != true || process.ExitCode != 0)
                throw new AdapterException(result["code"]?.GetValue<string>() ?? "host-failed", result["message"]?.GetValue<string>() ?? "Adapter host failed.");
            if (!File.Exists(outputPath)) throw new AdapterException("host-failed", "Adapter reported success but wrote no payload.");
            return new(result, File.ReadAllBytes(outputPath), hostOutput);
        }
        finally
        {
            // The work folder holds a copy of the donor; do not leave it behind.
            try { Directory.Delete(work, recursive: true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }
}
