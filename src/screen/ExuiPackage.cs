using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ExtronExporter.Format;

namespace ExtronExporter.Screen;

public sealed class ExuiException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed record ExuiProfile(string Id, string Panel, int Width, int Height);

/// <summary>A validated package snapshot. Resources live only in a private temporary directory.</summary>
public sealed class ExuiPackage : IDisposable
{
    public const int MaxPackageBytes = 20 * 1024 * 1024, MaxExpandedBytes = 16 * 1024 * 1024;
    private readonly string work;
    public string Sha256 { get; }
    public string ScreenSha256 { get; }
    public ExuiProfile Profile { get; }
    public GeneratePlan Plan { get; }
    /// <summary>exui/1: one page; exui/2: containers/navigation; exui/3: optional press feedback; exui/4: graphics and momentary buttons.</summary>
    public string Contract { get; }

    private ExuiPackage(string work, string sha, string screenSha, ExuiProfile profile, GeneratePlan plan, string contract)
    { this.work = work; Sha256 = sha; ScreenSha256 = screenSha; Profile = profile; Plan = plan; Contract = contract; }

    public static ExuiProfile GetProfile(string id) => id switch
    {
        "tlp-pro-1025m" => new(id, "TLP Pro 1025M", 1280, 800),
        "tlp-pro-300m-portrait" => new(id, "TLP Pro 300M", 320, 480),
        _ => throw new ExuiException("package-profile", $"Unsupported profile {id}.")
    };

    public static ExuiPackage Load(string path)
    {
        // Bound the actual read as well as the declared file/entry lengths.
        using var source = File.OpenRead(path);
        if (source.Length > MaxPackageBytes) throw new ExuiException("package-size", "Package exceeds 20 MiB.");
        byte[] bytes = ReadBounded(source, MaxPackageBytes);
        string? work = null;
        try
        {
            using var memory = new MemoryStream(bytes, false);
            using var zip = new ZipArchive(memory, ZipArchiveMode.Read);
            if (zip.Entries.Count < 2) throw new ExuiException("package-entries", "manifest.json and screen.json are required, no directory entries.");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in zip.Entries)
            {
                string name = entry.FullName;
                bool allowed = name is "manifest.json" or "screen.json" || Regex.IsMatch(name, @"\Aassets/[a-z0-9][a-z0-9-]{0,63}\.png\z", RegexOptions.CultureInvariant);
                if (!allowed || !names.Add(name)) throw new ExuiException("package-entry", $"Unsafe, unsupported or duplicate entry: {name}.");
                // Unix symlinks are not resources. No ZIP entry path is ever used as an extraction target.
                if (((entry.ExternalAttributes >> 16) & 0xF000) == 0xA000) throw new ExuiException("package-entry", $"Symlink entry: {name}.");
            }
            var manifestEntry = zip.GetEntry("manifest.json");
            if (manifestEntry == null || zip.GetEntry("screen.json") == null)
                throw new ExuiException("package-entries", "manifest.json and screen.json are required at ZIP root.");
            // A bounded manifest determines the number of resources before any PNG is read.
            // This replaces the arbitrary v5 count cap without admitting undeclared ZIP entries.
            byte[] manifestBytes = ReadEntry(manifestEntry, 64 * 1024);
            var manifest = ContractJson.Read(manifestBytes, "manifest.json");
            int version = manifest.ValueKind == JsonValueKind.Object && manifest.TryGetProperty("schema", out var marker) && marker.ValueKind == JsonValueKind.String
                ? marker.GetString() switch { "exui/1" => 1, "exui/2" => 2, "exui/3" => 3, "exui/4" => 4, "exui/5" => 5, _ => 0 } : 0;
            if (version == 0) throw new ExuiException("package-schema", "manifest.json: schema must be exui/1 through exui/5.");
            if (version < 5 && zip.Entries.Count > 18) throw new ExuiException("package-entries", "exui/1–4 allow at most 18 file entries.");
            ContractJson.Validate(manifest, version, "manifest");
            if (zip.Entries.Count != manifest.GetProperty("resources").GetArrayLength() + 2)
                throw new ExuiException("package-resource", "ZIP assets must exactly match manifest.resources.");
            var files = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            long total = 0;
            foreach (var entry in zip.Entries)
            {
                string name = entry.FullName;
                int limit = name == "manifest.json" ? 64 * 1024 : name == "screen.json" ? 256 * 1024 : ScreenSpecReader.MaxImageBytes;
                total += entry.Length;
                if (entry.Length > limit || total > MaxExpandedBytes) throw new ExuiException("package-size", $"Expanded size limit exceeded at {name}.");
                byte[] data = name == "manifest.json" ? manifestBytes : ReadEntry(entry, limit);
                files.Add(name, data);
            }
            byte[] screenBytes = files["screen.json"];
            var screen = ContractJson.Read(screenBytes, "screen.json");
            ContractJson.Validate(screen, version, "screen");
            var profile = GetProfile(manifest.GetProperty("profile").GetString()!);
            var declared = new HashSet<string>(StringComparer.Ordinal);
            foreach (var resource in manifest.GetProperty("resources").EnumerateArray())
            {
                string file = resource.GetProperty("path").GetString()!;
                if (!declared.Add(file)) throw new ExuiException("package-resource", $"Duplicate resource declaration: {file}.");
                if (!files.TryGetValue(file, out var data)) throw new ExuiException("package-resource", $"Missing resource: {file}.");
                if (!Hash(data).Equals(resource.GetProperty("sha256").GetString(), StringComparison.OrdinalIgnoreCase))
                    throw new ExuiException("package-integrity", $"Resource SHA-256 mismatch: {file}.");
                CheckPng(data, file);
            }
            if (!files.Keys.Where(n => n.StartsWith("assets/", StringComparison.Ordinal)).ToHashSet().SetEquals(declared))
                throw new ExuiException("package-resource", "ZIP assets must exactly match manifest.resources.");
            var assetPaths = screen.GetProperty("assets").EnumerateArray().Select(a => a.GetProperty("file").GetString()!).ToArray();
            if (assetPaths.Distinct(StringComparer.Ordinal).Count() != assetPaths.Length || !declared.SetEquals(assetPaths))
                throw new ExuiException("package-resource", "screen.assets must reference each manifest resource exactly once.");

            // Lower to the proven experimental model. State identity is explicit and independent of
            // input order: normal=0, feedback=1, pressed=2; no IDs are inferred from array order.
            var lowered = ContractJson.LowerNumbers(screen)!.AsObject();
            lowered["schema"] = ScreenSpecReader.Schema;
            lowered["panel"] = profile.Panel;
            var elementLists = !lowered.ContainsKey("pages")
                ? new[] { lowered["elements"]!.AsArray() }
                : lowered["pages"]!.AsArray().Concat(lowered["popups"]!.AsArray()).Select(c => c!["elements"]!.AsArray()).ToArray();
            foreach (var list in elementLists) SortStates(list, version >= 3, version >= 4, version == 5);
            work = Directory.CreateTempSubdirectory("exui-package-").FullName;
            Directory.CreateDirectory(Path.Combine(work, "assets"));
            foreach (string file in declared) File.WriteAllBytes(Path.Combine(work, file), files[file]);
            var spec = JsonSerializer.Deserialize<ScreenSpec>(lowered.ToJsonString(), ScreenSpecReader.Json)!;
            var plan = ScreenSpecReader.Normalize(spec, profile.Panel, profile.Width, profile.Height, work, allowTwoStateButtons: version >= 3, allowGraphics: version >= 4, allowMomentaryButtons: version >= 4, allowExtended: version == 5);
            return new(work, Hash(bytes), Hash(screenBytes), profile, plan, $"exui/{version}");
        }
        catch (Exception e)
        {
            if (work != null) Directory.Delete(work, true);
            if (e is InvalidDataException) throw new ExuiException("package-zip", e.Message);
            throw;
        }
    }

    private static void SortStates(JsonArray elements, bool allowTwoStateButtons, bool allowMomentaryButtons, bool extended = false)
    {
        foreach (var element in elements)
        {
            if (element!["states"] is not JsonArray) continue;
            var states = element["states"]!.AsArray();
            var sorted = states.Select(s => s!.AsObject()).OrderBy(s => (int)s["stateId"]!).ToArray();
            if (extended)
            {
                if (!sorted.Select(s => (int)s["stateId"]!).SequenceEqual(Enumerable.Range(0, sorted.Length)) || sorted.Length is < 2 or > 8 ||
                    (string?)sorted[0]["role"] != "normal" || sorted.Skip(1).Any(s => (string?)s["role"] == "normal"))
                    throw new ExuiException("package-state", "exui/5 states require dense IDs 0..N, starting with normal.");
                states.Clear(); foreach (var state in sorted) { state.Remove("stateId"); states.Add(state); }
                continue;
            }
            bool two = allowTwoStateButtons && sorted.Length == 2;
            bool momentary = allowMomentaryButtons && sorted.Length == 2 && (string?)sorted[1]["role"] == "pressed";
            if (!sorted.Select(s => (int)s["stateId"]!).SequenceEqual(two ? new[] { 0, 1 } : new[] { 0, 1, 2 }) ||
                !sorted.Select(s => (string)s["role"]!).SequenceEqual(momentary ? new[] { "normal", "pressed" } : two ? new[] { "normal", "feedback" } : new[] { "normal", "feedback", "pressed" }))
                throw new ExuiException("package-state", $"{element["key"]}: explicit stateId/role must be {(allowMomentaryButtons ? "0/normal + 1/pressed, or " : "")}0/normal, 1/feedback{(allowTwoStateButtons ? ", and optional 2/pressed" : ", 2/pressed")}.");
            states.Clear();
            foreach (var state in sorted) { state.Remove("stateId"); states.Add(state); }
        }
    }

    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));

    private static byte[] ReadEntry(ZipArchiveEntry entry, int limit)
    {
        if (entry.Length > limit) throw new ExuiException("package-size", $"Expanded size limit exceeded at {entry.FullName}.");
        using var stream = entry.Open();
        byte[] data = ReadBounded(stream, limit);
        if (data.LongLength != entry.Length || ExtronContainer.Crc32(data) != entry.Crc32)
            throw new ExuiException("package-integrity", $"ZIP length/CRC mismatch: {entry.FullName}.");
        return data;
    }

    private static byte[] ReadBounded(Stream stream, int limit)
    {
        using var result = new MemoryStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.Read(buffer)) > 0)
        {
            if (result.Length + count > limit) throw new ExuiException("package-size", "Actual data exceeds size limit.");
            result.Write(buffer, 0, count);
        }
        return result.ToArray();
    }

    private static void CheckPng(byte[] bytes, string file)
    {
        void Fail() => throw new ExuiException("package-image", $"{file}: invalid PNG structure/CRC or unsupported dimensions.");
        if (!ScreenSpecReader.TryPngSize(bytes, out int w, out int h) || w > ScreenSpecReader.MaxImageSide || h > ScreenSpecReader.MaxImageSide) Fail();
        int cursor = 8; bool data = false, ended = false;
        while (cursor <= bytes.Length - 12)
        {
            uint length = BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(cursor));
            if (length > bytes.Length - cursor - 12) Fail();
            int len = (int)length;
            var type = bytes.AsSpan(cursor + 4, 4);
            if (ExtronContainer.Crc32(bytes.AsSpan(cursor + 4, len + 4)) != BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(cursor + 8 + len))) Fail();
            if (cursor == 8 && (!type.SequenceEqual("IHDR"u8) || len != 13)) Fail();
            if (type.SequenceEqual("IDAT"u8)) data = true;
            cursor += len + 12;
            if (type.SequenceEqual("IEND"u8)) { if (len != 0) Fail(); ended = true; break; }
        }
        if (!data || !ended || cursor != bytes.Length) Fail();
    }

    public void Dispose() => Directory.Delete(work, true);
}
