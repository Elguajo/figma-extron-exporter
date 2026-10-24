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
    public string? CompatibilityPath { get; init; }

    public static AdapterOptions Default(string? installDir = null) => new(
        installDir ?? Environment.GetEnvironmentVariable("EXTRON_GUI_DESIGNER_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Extron", "GUI Designer"),
        // SysWOW64 holds the 32-bit Windows PowerShell 5.1 on 64-bit Windows.
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe"),
        Path.Combine(AppContext.BaseDirectory, "host", "ExtronAdapterHost.ps1"),
        HostTimeout(Environment.GetEnvironmentVariable("EXUI_HOST_TIMEOUT")));

    /// <summary>Whole minutes from EXUI_HOST_TIMEOUT; unset keeps the 10-minute default.</summary>
    public static TimeSpan HostTimeout(string? minutes)
    {
        if (string.IsNullOrEmpty(minutes)) return TimeSpan.FromMinutes(10);
        if (!int.TryParse(minutes, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out int value) || value is < 1 or > 1440)
            throw new AdapterException("host-timeout", "EXUI_HOST_TIMEOUT must be whole minutes from 1 to 1440.");
        return TimeSpan.FromMinutes(value);
    }
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
    public CompatibilityProfile CheckEnvironment()
    {
        if (!OperatingSystem.IsWindows()) throw new AdapterException("host-missing", "The Extron adapter requires Windows.");
        if (!File.Exists(Options.PowerShellPath))
            throw new AdapterException("host-missing", $"32-bit Windows PowerShell 5.1 not found at {Options.PowerShellPath}.");
        if (!File.Exists(Options.HostScript)) throw new AdapterException("host-missing", $"Adapter host script not found at {Options.HostScript}.");
        string exe = Path.Combine(Options.InstallDir, "GUI Designer.exe");
        if (!File.Exists(exe))
            throw new AdapterException("extron-missing", $"Extron GUI Designer not found at {Options.InstallDir}. Install GUI Designer or pass --extron-dir.");
        string? version = FileVersionInfo.GetVersionInfo(exe).FileVersion;
        return Compatibility.Select(Compatibility.Load(Options.CompatibilityPath), version);
    }

    public JsonObject Probe() => Execute("probe", null, null, null, null).Result;

    /// <summary>Run one operation on one payload. The payload must already be allow-listed by the caller.</summary>
    public AdapterRun Run(string operation, byte[] payload, string sectionName, object section, string donorVersion)
        => Execute(operation, payload, sectionName, section, donorVersion);

    private AdapterRun Execute(string operation, byte[]? payload, string? sectionName, object? section, string? donorVersion)
    {
        var profile = CheckEnvironment();
        if (operation != "probe") profile.RequireDonorVersion(donorVersion ?? "");
        string work = Path.Combine(Path.GetTempPath(), "extron-adapter", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);
        try
        {
            string payloadPath = Path.Combine(work, "donor.ProjectGCP"), outputPath = Path.Combine(work, "output.ProjectGCP");
            string resultPath = Path.Combine(work, "result.json"), requestPath = Path.Combine(work, "request.json");
            if (payload != null) File.WriteAllBytes(payloadPath, payload);
            var request = new JsonObject
            {
                ["protocol"] = "extron-adapter/1",
                ["operation"] = operation,
                ["installDir"] = Options.InstallDir,
                ["guiDesignerVersion"] = profile.GuiDesignerVersion,
                ["donorVersion"] = donorVersion,
                ["compatibilityProfile"] = JsonSerializer.SerializeToNode(profile, RequestJson),
                ["payloadPath"] = payloadPath,
                ["payloadSha256"] = payload == null ? null : Convert.ToHexString(SHA256.HashData(payload)),
                ["outputPath"] = outputPath,
                ["resultPath"] = resultPath
            };
            if (sectionName != null && section != null)
                request[sectionName] = JsonSerializer.SerializeToNode(section, section.GetType(), RequestJson);
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
                // The host can exit between the timeout and Kill; the timeout is still reported.
                try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } catch (System.ComponentModel.Win32Exception) { }
                throw new AdapterException("host-timeout", $"Adapter host did not finish within {Options.Timeout.TotalMinutes} min.");
            }
            string hostOutput = (stdout.Result + stderr.Result).Trim();
            if (!File.Exists(resultPath))
                throw new AdapterException("host-failed", $"Adapter host exited with {process.ExitCode} without a result. Output: {hostOutput}");
            JsonObject result;
            bool ok;
            string? code, message;
            try
            {
                result = JsonNode.Parse(File.ReadAllText(resultPath))?.AsObject() ?? throw new AdapterException("host-failed", "Empty adapter result.");
                ok = result["ok"]?.GetValue<bool>() == true;
                code = result["code"]?.GetValue<string>(); message = result["message"]?.GetValue<string>();
            }
            catch (Exception e) when (e is JsonException or InvalidOperationException or FormatException)
            {
                throw new AdapterException("host-failed", $"Adapter host wrote an unreadable result ({e.Message}). Output: {hostOutput}");
            }
            if (!ok || process.ExitCode != 0)
                throw new AdapterException(code ?? "host-failed", message ?? "Adapter host failed.");
            Compatibility.ValidateProbe(result);
            if (operation == "probe") return new(result, [], hostOutput);
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
