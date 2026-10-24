using System.IO.Compression;
using System.Text;
using ExtronExporter.Screen;

// Deterministic mutation fuzzing of the package reader. Every damaged package must be
// refused with an error the CLI reports as "ERROR ...", never an unexpected exception type.
static class FuzzTests
{
    static readonly string Seed = Path.Combine(ScreenTests.Root, "examples", "exui-v5", "project-1025m.exui");

    public static void Unit(Action<string, Action> test)
    {
        byte[] original = File.ReadAllBytes(Seed);
        var entries = Entries(original);
        test("Fuzz: damaged ZIP bytes are refused with a reported error", () =>
        {
            var random = new Random(20261024);
            for (int i = 0; i < 60; i++)
            {
                byte[] bytes = original.ToArray();
                if (i % 5 == 0) bytes = bytes[..random.Next(bytes.Length)];
                else for (int n = random.Next(1, 8); n > 0; n--) bytes[random.Next(bytes.Length)] = (byte)random.Next(256);
                Load(bytes, $"byte mutation {i}");
            }
        });
        foreach (string name in new[] { "manifest.json", "screen.json" })
            test($"Fuzz: damaged {name} is refused with a reported error", () =>
            {
                var random = new Random(name[0]);
                string text = Encoding.UTF8.GetString(entries[name]);
                const string alphabet = "{}[]\":,0123456789-.aAzZ \\\u0000éЖ";
                for (int i = 0; i < 60; i++)
                {
                    var chars = text.ToCharArray();
                    for (int n = random.Next(1, 4); n > 0; n--) chars[random.Next(chars.Length)] = alphabet[random.Next(alphabet.Length)];
                    string damaged = i % 7 == 0 ? text[..random.Next(text.Length)] : new string(chars);
                    Load(Zip(entries, name, Encoding.UTF8.GetBytes(damaged)), $"{name} mutation {i}");
                }
            });
    }

    static Dictionary<string, byte[]> Entries(byte[] package)
    {
        using var zip = new ZipArchive(new MemoryStream(package), ZipArchiveMode.Read);
        return zip.Entries.ToDictionary(e => e.FullName, e => { using var s = e.Open(); using var m = new MemoryStream(); s.CopyTo(m); return m.ToArray(); });
    }

    static byte[] Zip(Dictionary<string, byte[]> entries, string replaced, byte[] data)
    {
        using var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
            foreach (var (name, bytes) in entries)
                using (var entry = zip.CreateEntry(name).Open()) entry.Write(name == replaced ? data : bytes);
        return stream.ToArray();
    }

    static void Load(byte[] bytes, string what)
    {
        string path = Path.Combine(Path.GetTempPath(), "exui-fuzz-" + Guid.NewGuid().ToString("N") + ".exui");
        File.WriteAllBytes(path, bytes);
        try { using var package = ExuiPackage.Load(path); }
        catch (Exception e) when (e is ExuiException or ScreenSpecException or InvalidDataException) { }
        catch (Exception e) { throw new Exception($"{what}: unexpected {e.GetType().Name}: {e.Message}"); }
        finally { File.Delete(path); }
    }
}
