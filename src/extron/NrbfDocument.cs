using System.Formats.Nrbf;
using System.Text;

namespace ExtronExporter.Format;

// Data-only graph. No CLR type named by the input is resolved or instantiated.
// The writer emits the supported MS-NRBF records, then verifies them with Microsoft's decoder.
internal sealed class NrbfNode
{
    public string Type = "", Library = "";
    public Dictionary<string, object?>? Fields;
    public Array? Values;
    public string? Text;
}

internal sealed class NrbfDocument
{
    public NrbfNode Root { get; }
    private NrbfDocument(NrbfNode root) => Root = root;

    public static NrbfDocument Read(byte[] payload)
    {
        if (payload.Length > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        using var input = new MemoryStream(payload, false);
        var record = NrbfDecoder.Decode(input, out _, leaveOpen: true);
        if (input.Position != input.Length) throw new InvalidDataException("Trailing NRBF data.");
        var nodes = new Dictionary<SerializationRecordId, NrbfNode>();
        var pending = new Queue<(SerializationRecord Record, NrbfNode Node)>();
        NrbfNode Node(SerializationRecord r)
        {
            if (nodes.TryGetValue(r.Id, out var prior)) return prior;
            if (nodes.Count >= 250000) throw new NotSupportedException("Reconciliation graph exceeds 250000 records.");
            var n = new NrbfNode { Type = r.TypeName.FullName, Library = r.TypeName.AssemblyName?.FullName ?? "" };
            nodes.Add(r.Id, n); pending.Enqueue((r, n)); return n;
        }
        var root = Node(record);
        while (pending.TryDequeue(out var item))
        {
            var (r, n) = item;
            switch (r)
            {
                case ClassRecord c:
                    n.Fields = new(StringComparer.Ordinal);
                    foreach (string name in c.MemberNames)
                    {
                        object? value = c.GetRawValue(name);
                        n.Fields.Add(name, value is string ? Node(c.GetSerializationRecord(name)!) : value is SerializationRecord reference ? Node(reference) : value);
                    }
                    break;
                case PrimitiveTypeRecord p when p.Value is string text: n.Text = text; break;
                case ArrayRecord a when a.Lengths.Length == 1 && a.TypeName.IsSZArray:
                    if (a is SZArrayRecord<SerializationRecord> refs) n.Values = refs.GetArray().Select(x => x == null ? null : Node(x)).ToArray();
                    else if (a is SZArrayRecord<string> strings) n.Values = strings.GetArray().Select(x => x == null ? null : new NrbfNode { Type = "System.String", Text = x }).ToArray();
                    else n.Values = a.GetType().GetMethod("GetArray", [typeof(bool)])?.Invoke(a, [true]) as Array
                        ?? throw new NotSupportedException("Unsupported NRBF array.");
                    break;
                default: throw new NotSupportedException($"Reconciliation does not support NRBF record {r.RecordType} / {r.TypeName.FullName}.");
            }
        }
        return new(root);
    }

    public byte[] Write()
    {
        using var output = new MemoryStream();
        using var w = new BinaryWriter(output, new UTF8Encoding(false, true), true);
        var ids = new Dictionary<NrbfNode, int>();
        var pending = new Queue<NrbfNode>();
        var libraries = new Dictionary<string, int>(StringComparer.Ordinal);
        int Id(NrbfNode n) { if (!ids.TryGetValue(n, out int id)) { ids[n] = id = ids.Count + 1; pending.Enqueue(n); } return id; }
        int Library(string name)
        {
            if (!libraries.TryGetValue(name, out int id)) { libraries[name] = id = libraries.Count + 1000001; w.Write((byte)12); w.Write(id); w.Write(name); }
            return id;
        }
        void Value(object? value)
        {
            if (value == null) w.Write((byte)10);
            else if (value is NrbfNode node) { w.Write((byte)9); w.Write(Id(node)); }
            else { w.Write((byte)8); byte kind = PrimitiveKind(value); w.Write(kind); Primitive(w, kind, value); }
        }
        w.Write((byte)0); w.Write(Id(Root)); w.Write(-1); w.Write(1); w.Write(0);
        while (pending.TryDequeue(out var n))
        {
            if (n.Fields is { } fields)
            {
                int lib = Library(n.Library);
                w.Write((byte)5); w.Write(ids[n]); w.Write(n.Type); w.Write(fields.Count);
                foreach (string name in fields.Keys) w.Write(name);
                foreach (object? value in fields.Values) w.Write((byte)(value != null && value is not NrbfNode ? 0 : 2));
                foreach (object? value in fields.Values) if (value != null && value is not NrbfNode) w.Write(PrimitiveKind(value));
                w.Write(lib);
                foreach (object? value in fields.Values)
                    if (value != null && value is not NrbfNode) Primitive(w, PrimitiveKind(value), value); else Value(value);
            }
            else if (n.Text != null) { w.Write((byte)6); w.Write(ids[n]); w.Write(n.Text); }
            else if (n.Values is { } values)
            {
                if (values.GetType().GetElementType() != typeof(NrbfNode))
                {
                    byte kind = PrimitiveKind(Activator.CreateInstance(values.GetType().GetElementType()!)!);
                    w.Write((byte)15); w.Write(ids[n]); w.Write(values.Length); w.Write(kind);
                    if (values is byte[] bytes) w.Write(bytes); else foreach (object value in values) Primitive(w, kind, value);
                }
                else if (n.Type == "System.Object[]" || n.Type == "System.String[]")
                {
                    w.Write((byte)(n.Type == "System.String[]" ? 17 : 16)); w.Write(ids[n]); w.Write(values.Length);
                    foreach (object? value in values) Value(value);
                }
                else
                {
                    int lib = Library(n.Library);
                    w.Write((byte)7); w.Write(ids[n]); w.Write((byte)0); w.Write(1); w.Write(values.Length);
                    w.Write((byte)4); w.Write(n.Type[..^2]); w.Write(lib);
                    foreach (object? value in values) Value(value);
                }
            }
            else throw new NotSupportedException("Empty NRBF node.");
            if (output.Length > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Updated payload too large.");
        }
        w.Write((byte)11); w.Flush();
        byte[] result = output.ToArray();
        AssertEquivalent(Root, Read(result).Root);
        return result;
    }

    private static byte PrimitiveKind(object value) => value switch
    {
        bool => 1, byte => 2, char => 3, decimal => 5, double => 6, short => 7, int => 8, long => 9,
        sbyte => 10, float => 11, TimeSpan => 12, DateTime => 13, ushort => 14, uint => 15, ulong => 16,
        _ => throw new NotSupportedException($"Unsupported primitive {value.GetType().Name}.")
    };
    private static void Primitive(BinaryWriter w, byte kind, object value)
    {
        switch (kind)
        {
            case 1: w.Write((bool)value); break; case 2: w.Write((byte)value); break; case 3: w.Write((char)value); break;
            case 5: w.Write(((decimal)value).ToString(System.Globalization.CultureInfo.InvariantCulture)); break;
            case 6: w.Write((double)value); break; case 7: w.Write((short)value); break; case 8: w.Write((int)value); break;
            case 9: w.Write((long)value); break; case 10: w.Write((sbyte)value); break; case 11: w.Write((float)value); break;
            case 12: w.Write(((TimeSpan)value).Ticks); break;
            case 13: w.Write(System.Runtime.CompilerServices.Unsafe.BitCast<DateTime, long>((DateTime)value)); break;
            case 14: w.Write((ushort)value); break; case 15: w.Write((uint)value); break; case 16: w.Write((ulong)value); break;
            default: throw new NotSupportedException("Unsupported primitive kind.");
        }
    }

    internal static string Member(NrbfNode n, string name) => n.Fields?.Keys.SingleOrDefault(k => k == name || k.EndsWith("+" + name, StringComparison.Ordinal))
        ?? throw new NotSupportedException($"Missing {n.Type}.{name}.");
    internal static object? Get(NrbfNode n, string name) => n.Fields![Member(n, name)];
    internal static void Set(NrbfNode n, string name, object? value) => n.Fields![Member(n, name)] = value;
    internal static string? Text(NrbfNode n, string name) => (Get(n, name) as NrbfNode)?.Text;
    internal static NrbfNode Child(NrbfNode n, string name) => Get(n, name) as NrbfNode ?? throw new NotSupportedException($"Missing {name}.");
    internal static NrbfNode[] Items(NrbfNode n)
    {
        if (n.Fields!.ContainsKey("mItems")) n = Child(n, "mItems");
        int count = (int)Get(n, "_size")!;
        var array = Child(n, "_items").Values!;
        if (count < 0 || count > array.Length) throw new InvalidDataException("Invalid collection count.");
        return array.Cast<NrbfNode?>().Take(count).Select(v => v ?? throw new InvalidDataException("Null collection item.")).ToArray();
    }

    internal static NrbfNode Copy(NrbfNode node) => new() { Type = node.Type, Library = node.Library, Text = node.Text,
        Fields = node.Fields == null ? null : new(node.Fields, StringComparer.Ordinal), Values = node.Values == null ? null : (Array)node.Values.Clone() };

    internal static void AssertEquivalent(NrbfNode before, NrbfNode after, Func<NrbfNode, string, bool>? ignore = null)
    {
        var pairs = new Dictionary<NrbfNode, NrbfNode>();
        var reverse = new Dictionary<NrbfNode, NrbfNode>();
        var pending = new Stack<(NrbfNode Before, NrbfNode After, string Path)>(); pending.Push((before, after, before.Type));
        void Value(object? x, object? y, string path)
        {
            if (x is NrbfNode a && y is NrbfNode b) pending.Push((a, b, path));
            else if (!Equals(x, y)) throw new InvalidDataException($"Unexpected change to protected value {path}.");
        }
        while (pending.TryPop(out var pair))
        {
            var (a, b, path) = pair;
            if (pairs.TryGetValue(a, out var prior)) { if (prior != b) throw new InvalidDataException("Shared NRBF reference changed."); continue; }
            if (reverse.TryGetValue(b, out var previous) && previous != a) throw new InvalidDataException("Distinct NRBF references were merged.");
            pairs.Add(a, b); reverse.Add(b, a);
            if (a.Type != b.Type || a.Text == null && a.Library != b.Library || a.Text != b.Text) throw new InvalidDataException($"NRBF type or text changed: {path} ({a.Type}).");
            if (a.Fields != null && b.Fields != null)
            {
                if (!a.Fields.Keys.SequenceEqual(b.Fields.Keys)) throw new InvalidDataException("NRBF members changed.");
                foreach (var (name, value) in a.Fields) if (ignore?.Invoke(a, name) != true) Value(value, b.Fields[name], path + "." + name);
            }
            else if (a.Values != null && b.Values != null)
            {
                if (a.Values.Length != b.Values.Length) throw new InvalidDataException("NRBF array length changed.");
                if (a.Values is NrbfNode?[] x && b.Values is NrbfNode?[] y)
                    for (int i = 0; i < x.Length; i++) Value(x[i], y[i], path + $"[{i}]");
                else if (!System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(a.Values, b.Values)) throw new InvalidDataException("NRBF array data changed.");
            }
            else if ((a.Fields == null) != (b.Fields == null) || (a.Values == null) != (b.Values == null)) throw new InvalidDataException("NRBF node shape changed.");
        }
    }
}
