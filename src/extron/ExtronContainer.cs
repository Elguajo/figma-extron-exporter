using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace ExtronExporter.Format;

/// <summary>
/// Observed KP container profile: one ProjectGCP entry, optionally followed by entries GUI Designer's
/// Save and Build adds (for example &lt;project&gt;.tgz4). Entries are parsed structurally from the central
/// directory and must be laid out contiguously. Does not instantiate Extron objects.
/// </summary>
public sealed class ExtronContainer
{
    public const int MaxFileBytes = 64 * 1024 * 1024;
    public const int MaxPayloadBytes = 128 * 1024 * 1024;
    public const int MaxEntries = 16;
    public const string ProjectEntryName = "ProjectGCP";

    /// <summary>Metadata of one entry, as declared by the central directory and verified against its data.</summary>
    public sealed record Entry(string Name, ushort CompressionMethod, int CompressedBytes, int RawBytes, uint Crc32);

    // One entry as stored: local header (with name/extra), packed data, central record.
    private sealed record StoredEntry(Entry Info, byte[] LocalHeader, byte[] Packed, byte[] Central);

    private readonly IReadOnlyList<StoredEntry> stored;
    private readonly int projectIndex;
    private readonly byte[] endRecord;

    public byte[] Payload { get; }
    public string EntryName => ProjectEntryName;
    public ushort CompressionMethod => stored[projectIndex].Info.CompressionMethod;
    public IReadOnlyList<Entry> Entries => stored.Select(s => s.Info).ToArray();
    public bool HasBuildOutput => stored.Count > 1;

    private ExtronContainer(IReadOnlyList<StoredEntry> entries, int project, byte[] end, byte[] payload)
    {
        stored = entries; projectIndex = project; endRecord = end; Payload = payload;
    }

    public static ExtronContainer ReadFile(string path)
    {
        using var file = File.OpenRead(path);
        if (file.Length > MaxFileBytes) throw new InvalidDataException("Container exceeds 64 MiB limit.");
        var data = new byte[checked((int)file.Length)];
        file.ReadExactly(data);
        return Parse(data);
    }

    public static ExtronContainer Parse(byte[] data)
    {
        if (data.Length > MaxFileBytes) throw new InvalidDataException("Container exceeds 64 MiB limit.");
        if (data.Length < 22) throw new InvalidDataException("Truncated container.");
        int end = -1;
        for (int p = data.Length - 22; p >= Math.Max(0, data.Length - 65557); p--)
            if (Signature(data, p, 5, 6) && p + 22 + U16(data, p + 20) == data.Length) { end = p; break; }
        if (end < 0) throw new InvalidDataException("Missing KP end record or invalid archive comment length.");
        int count = U16(data, end + 10);
        if (U16(data, end + 4) != 0 || U16(data, end + 6) != 0 || U16(data, end + 8) != count)
            throw new InvalidDataException("Only single-disk containers are supported.");
        if (count < 1 || count > MaxEntries) throw new InvalidDataException($"Expected 1..{MaxEntries} entries, found {count}.");
        int central = Size(U32(data, end + 16)), centralSize = Size(U32(data, end + 12));
        if ((long)central + centralSize != end) throw new InvalidDataException("Invalid central directory bounds.");

        var entries = new List<StoredEntry>(count);
        long totalRaw = 0;
        int cursor = central, expectedLocal = 0;
        byte[]? payload = null;
        int project = -1;
        for (int i = 0; i < count; i++)
        {
            if (cursor > end - 46 || !Signature(data, cursor, 1, 2)) throw new InvalidDataException($"Central record {i} is missing or truncated.");
            ushort flags = U16(data, cursor + 8), method = U16(data, cursor + 10);
            if ((flags & ~0x0800) != 0 || method is not (0 or 8))
                throw new InvalidDataException("Unsupported flags or compression; expected stored/DEFLATE without descriptors.");
            if (U16(data, cursor + 6) > 20 || U16(data, cursor + 34) != 0)
                throw new InvalidDataException("ZIP64 and multiple disks are unsupported.");
            int nameLength = U16(data, cursor + 28), extraLength = U16(data, cursor + 30), commentLength = U16(data, cursor + 32);
            int recordLength = 46 + nameLength + extraLength + commentLength;
            if ((long)cursor + recordLength > end) throw new InvalidDataException("Central directory length mismatch.");
            int packedSize = Size(U32(data, cursor + 20)), rawSize = Size(U32(data, cursor + 24));
            uint crc = U32(data, cursor + 16);
            totalRaw += rawSize;
            if (rawSize > MaxPayloadBytes || totalRaw > MaxPayloadBytes) throw new InvalidDataException("Expanded entries exceed 128 MiB limit.");
            // Strict layout: entries follow each other from offset 0 and the central directory follows the last one.
            int local = Size(U32(data, cursor + 42));
            if (local != expectedLocal) throw new InvalidDataException("Entries must be contiguous from the start of the file, in central-directory order.");
            if ((long)local + 30 > central || !Signature(data, local, 3, 4)) throw new InvalidDataException($"Missing local entry {i}.");
            if (U16(data, local + 4) != U16(data, cursor + 6) || U16(data, local + 6) != flags || U16(data, local + 8) != method ||
                U32(data, local + 14) != crc || U32(data, local + 18) != packedSize || U32(data, local + 22) != rawSize)
                throw new InvalidDataException("Local and central entry metadata disagree.");
            int localNameLength = U16(data, local + 26), localExtraLength = U16(data, local + 28);
            long start = (long)local + 30 + localNameLength + localExtraLength;
            if (localNameLength != nameLength || start + packedSize > central)
                throw new InvalidDataException("Local entry bounds disagree with central directory.");
            if (!data.AsSpan(local + 30, nameLength).SequenceEqual(data.AsSpan(cursor + 46, nameLength)))
                throw new InvalidDataException("Local and central entry names disagree.");
            string name = Encoding.ASCII.GetString(data, cursor + 46, nameLength);
            if (nameLength == 0 || name.Any(c => c < 0x20 || c > 0x7e) || name.Contains('/') || name.Contains('\\'))
                throw new InvalidDataException("Entry names must be plain ASCII file names.");
            if (entries.Any(e => e.Info.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidDataException($"Duplicate entry '{name}'.");
            byte[] raw = Expand(data, (int)start, packedSize, rawSize, method);
            if (Crc32(raw) != crc) throw new InvalidDataException($"CRC32 mismatch in entry '{name}'.");
            if (name == ProjectEntryName)
            {
                if (i != 0) throw new InvalidDataException("ProjectGCP must be the first entry.");
                payload = raw; project = i;
            }
            entries.Add(new(new(name, method, packedSize, rawSize, crc), data[local..(int)start],
                data[(int)start..((int)start + packedSize)], data[cursor..(cursor + recordLength)]));
            expectedLocal = (int)start + packedSize;
            cursor += recordLength;
        }
        if (cursor != end) throw new InvalidDataException("Central directory length mismatch.");
        if (expectedLocal != central) throw new InvalidDataException("Unexpected bytes between entries and central directory.");
        if (payload == null) throw new InvalidDataException("Expected one ProjectGCP entry.");
        return new(entries, project, data[end..], payload);
    }

    /// <summary>Recompress the same NRBF bytes. This is not an object-graph writer.</summary>
    public byte[] Repack()
        => RepackWithPayload(Payload);

    /// <summary>Edited layouts must be rebuilt; never carry an obsolete panel archive into the new GDL.</summary>
    public byte[] RepackEditablePayload(byte[] payload)
    {
        byte[] end = endRecord.ToArray();
        BinaryPrimitives.WriteUInt16LittleEndian(end.AsSpan(8), 1);
        BinaryPrimitives.WriteUInt16LittleEndian(end.AsSpan(10), 1);
        return new ExtronContainer([stored[projectIndex]], 0, end, Payload).RepackWithPayload(payload);
    }

    /// <summary>
    /// Package explicitly supplied NRBF bytes; caller owns graph validation. Other entries are copied
    /// byte for byte with recomputed offsets.
    /// </summary>
    public byte[] RepackWithPayload(byte[] payload)
    {
        if (payload.Length > MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        var project = stored[projectIndex];
        byte[] packed;
        if (project.Info.CompressionMethod == 0) packed = payload.ToArray();
        else
        {
            using var stream = new MemoryStream();
            using (var encoder = new DeflateStream(stream, CompressionLevel.Optimal, leaveOpen: true)) encoder.Write(payload);
            packed = stream.ToArray();
        }
        uint crc = Crc32(payload);
        using var result = new MemoryStream();
        var centrals = new List<byte[]>();
        for (int i = 0; i < stored.Count; i++)
        {
            var e = stored[i];
            var local = e.LocalHeader.ToArray(); var centralRecord = e.Central.ToArray();
            var data = e.Packed;
            if (i == projectIndex)
            {
                data = packed;
                Put(local, 14, crc); Put(local, 18, (uint)packed.Length); Put(local, 22, (uint)payload.Length);
                Put(centralRecord, 16, crc); Put(centralRecord, 20, (uint)packed.Length); Put(centralRecord, 24, (uint)payload.Length);
            }
            Put(centralRecord, 42, checked((uint)result.Length));
            result.Write(local); result.Write(data);
            centrals.Add(centralRecord);
        }
        var end = endRecord.ToArray();
        uint centralOffset = checked((uint)result.Length);
        foreach (var c in centrals) result.Write(c);
        Put(end, 12, checked((uint)(result.Length - centralOffset))); Put(end, 16, centralOffset);
        result.Write(end);
        if (result.Length > MaxFileBytes) throw new InvalidDataException("Repacked container exceeds 64 MiB limit.");
        return result.ToArray();
    }

    /// <summary>Raw bytes of a non-project entry (for example the built .tgz4). Validated by CRC on read.</summary>
    public byte[] ReadEntry(string name)
    {
        var e = stored.SingleOrDefault(s => s.Info.Name == name) ?? throw new KeyNotFoundException($"No entry '{name}'.");
        return Expand(e.Packed, 0, e.Packed.Length, e.Info.RawBytes, e.Info.CompressionMethod);
    }

    private static byte[] Expand(byte[] data, int start, int packedSize, int rawSize, ushort method)
    {
        var raw = new byte[rawSize];
        if (method == 0)
        {
            if (packedSize != rawSize) throw new InvalidDataException("Stored entry size mismatch.");
            data.AsSpan(start, packedSize).CopyTo(raw);
            return raw;
        }
        using var packed = new MemoryStream(data, start, packedSize, writable: false);
        using var decoder = new DeflateStream(packed, CompressionMode.Decompress);
        try { decoder.ReadExactly(raw); }
        catch (EndOfStreamException e) { throw new InvalidDataException("Truncated DEFLATE payload.", e); }
        if (decoder.ReadByte() != -1) throw new InvalidDataException("Expanded payload exceeds declared size.");
        return raw;
    }

    public static uint Crc32(ReadOnlySpan<byte> bytes)
    {
        uint crc = uint.MaxValue;
        foreach (byte b in bytes)
        {
            crc ^= b;
            for (int bit = 0; bit < 8; bit++) crc = (crc >> 1) ^ (0xEDB88320u & (uint)-(int)(crc & 1));
        }
        return ~crc;
    }

    private static bool Signature(byte[] b, int p, byte a, byte c) => p >= 0 && p <= b.Length - 4 && b[p] == 'K' && b[p + 1] == 'P' && b[p + 2] == a && b[p + 3] == c;
    private static int Size(uint value) => value <= int.MaxValue ? (int)value : throw new InvalidDataException("ZIP64/oversize values are unsupported.");
    private static ushort U16(byte[] b, int p) => BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(p, 2));
    private static uint U32(byte[] b, int p) => BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(p, 4));
    private static void Put(byte[] b, int p, uint n) => BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(p, 4), n);
}
