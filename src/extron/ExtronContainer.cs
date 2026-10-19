using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace ExtronExporter.Format;

/// <summary>Observed single-entry KP container profile. Does not instantiate Extron objects.</summary>
public sealed class ExtronContainer
{
    public const int MaxFileBytes = 64 * 1024 * 1024;
    public const int MaxPayloadBytes = 128 * 1024 * 1024;
    private readonly byte[] localHeader;
    private readonly byte[] centralDirectory;
    private readonly byte[] endRecord;
    public byte[] Payload { get; }
    public string EntryName => "ProjectGCP";
    public ushort CompressionMethod { get; }

    private ExtronContainer(byte[] local, byte[] central, byte[] end, byte[] payload, ushort method)
    {
        localHeader = local; centralDirectory = central; endRecord = end;
        Payload = payload; CompressionMethod = method;
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
        if (U16(data, end + 4) != 0 || U16(data, end + 6) != 0 ||
            U16(data, end + 8) != 1 || U16(data, end + 10) != 1)
            throw new InvalidDataException("Only single-disk, single-entry containers are supported.");
        int central = Size(U32(data, end + 16)), centralSize = Size(U32(data, end + 12));
        if ((long)central + centralSize != end || centralSize < 46 || !Signature(data, central, 1, 2))
            throw new InvalidDataException("Invalid central directory bounds or signature.");
        ushort flags = U16(data, central + 8), method = U16(data, central + 10);
        if ((flags & ~0x0800) != 0 || method is not (0 or 8))
            throw new InvalidDataException("Unsupported flags or compression; expected stored/DEFLATE without descriptors.");
        if (U16(data, central + 6) > 20 || U16(data, central + 34) != 0 || U32(data, central + 42) != 0)
            throw new InvalidDataException("ZIP64, multiple disks and prefixed local entries are unsupported.");
        int nameLength = U16(data, central + 28), extraLength = U16(data, central + 30), commentLength = U16(data, central + 32);
        if (46 + nameLength + extraLength + commentLength != centralSize)
            throw new InvalidDataException("Central directory length mismatch.");
        int packedSize = Size(U32(data, central + 20)), rawSize = Size(U32(data, central + 24));
        if (rawSize > MaxPayloadBytes) throw new InvalidDataException("Payload exceeds 128 MiB limit.");
        if (!Signature(data, 0, 3, 4) || central < 30) throw new InvalidDataException("Missing local entry.");
        if (U16(data, 4) != U16(data, central + 6) || U16(data, 6) != flags || U16(data, 8) != method ||
            U32(data, 14) != U32(data, central + 16) || U32(data, 18) != packedSize || U32(data, 22) != rawSize)
            throw new InvalidDataException("Local and central entry metadata disagree.");
        int localNameLength = U16(data, 26), localExtraLength = U16(data, 28);
        int start = 30 + localNameLength + localExtraLength;
        if ((long)start + packedSize != central || localNameLength != nameLength)
            throw new InvalidDataException("Local entry bounds disagree with central directory.");
        var localName = data.AsSpan(30, localNameLength);
        if (!localName.SequenceEqual(data.AsSpan(central + 46, nameLength)) ||
            !localName.SequenceEqual(Encoding.ASCII.GetBytes("ProjectGCP")))
            throw new InvalidDataException("Expected exactly one ProjectGCP entry.");
        var payload = new byte[rawSize];
        if (method == 0)
        {
            if (packedSize != rawSize) throw new InvalidDataException("Stored entry size mismatch.");
            data.AsSpan(start, packedSize).CopyTo(payload);
        }
        else
        {
            using var packed = new MemoryStream(data, start, packedSize, writable: false);
            using var decoder = new DeflateStream(packed, CompressionMode.Decompress);
            try { decoder.ReadExactly(payload); }
            catch (EndOfStreamException e) { throw new InvalidDataException("Truncated DEFLATE payload.", e); }
            if (decoder.ReadByte() != -1) throw new InvalidDataException("Expanded payload exceeds declared size.");
        }
        if (Crc32(payload) != U32(data, central + 16)) throw new InvalidDataException("Payload CRC32 mismatch.");
        return new(data[..start], data[central..end], data[end..], payload, method);
    }

    /// <summary>Recompress the same NRBF bytes. This is not an object-graph writer.</summary>
    public byte[] Repack()
        => RepackWithPayload(Payload);

    /// <summary>Package explicitly supplied NRBF bytes; caller owns graph validation.</summary>
    public byte[] RepackWithPayload(byte[] payload)
    {
        if (payload.Length > MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        byte[] packed;
        if (CompressionMethod == 0) packed = payload.ToArray();
        else
        {
            using var stream = new MemoryStream();
            using (var encoder = new DeflateStream(stream, CompressionLevel.Optimal, leaveOpen: true)) encoder.Write(payload);
            packed = stream.ToArray();
        }
        var local = localHeader.ToArray(); var central = centralDirectory.ToArray(); var end = endRecord.ToArray();
        uint crc = Crc32(payload);
        Put(local, 14, crc); Put(local, 18, (uint)packed.Length); Put(local, 22, (uint)payload.Length);
        Put(central, 16, crc); Put(central, 20, (uint)packed.Length); Put(central, 24, (uint)payload.Length);
        Put(end, 12, (uint)central.Length); Put(end, 16, checked((uint)(local.Length + packed.Length)));
        long size = (long)local.Length + packed.Length + central.Length + end.Length;
        if (size > MaxFileBytes) throw new InvalidDataException("Repacked container exceeds 64 MiB limit.");
        using var result = new MemoryStream((int)size);
        result.Write(local); result.Write(packed); result.Write(central); result.Write(end);
        return result.ToArray();
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
