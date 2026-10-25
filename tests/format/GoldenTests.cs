using System.Security.Cryptography;
using System.Text.Json;
using ExtronExporter.Adapter;
using ExtronExporter.Format;

// Generation is deterministic: the same package and donor give the same ProjectGCP bytes.
// These hashes guard refactorings of the adapter host and generator against any output change.
static class GoldenTests
{
    public static void Integration(Action<string, Action> test, string registryPath)
    {
        var registry = ScreenTests.LoadRegistry(registryPath); var adapter = new ExtronAdapter(AdapterOptions.Default());
        using var golden = JsonDocument.Parse(File.ReadAllText(Path.Combine(ScreenTests.Root, "tests", "format", "golden-gdl.json")));
        string work = Directory.CreateTempSubdirectory("exui-golden-").FullName;
        try
        {
            foreach (var entry in golden.RootElement.GetProperty("payloads").EnumerateObject())
                test($"Golden GDL payload: {entry.Name}", () =>
                {
                    string output = Path.Combine(work, Path.GetFileNameWithoutExtension(entry.Name) + ".gdl");
                    PackageGenerator.Generate(registry, Path.Combine(ScreenTests.Root, entry.Name), output, adapter);
                    string actual = Convert.ToHexString(SHA256.HashData(ExtronContainer.ReadFile(output).Payload));
                    if (actual != entry.Value.GetString()) throw new Exception($"payload {actual} differs from golden {entry.Value.GetString()}");
                });
        }
        finally { try { Directory.Delete(work, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
    }
}
