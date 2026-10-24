using System.Formats.Nrbf;

namespace ExtronExporter.Format;

/// <summary>
/// Structural comparison of two NRBF graphs from their roots: type names, member names, primitive values and
/// the shape of references. Record IDs are ignored, so two serializations of equal graphs compare equal.
/// </summary>
public static class NrbfGraph
{
    public sealed record Difference(string Path, string Left, string Right);

    public static IReadOnlyList<Difference> Compare(byte[] left, byte[] right, ISet<string>? ignoreMembers = null, int maxDifferences = 50)
    {
        var a = Decode(left); var b = Decode(right);
        var ignore = ignoreMembers ?? new HashSet<string>();
        var differences = new List<Difference>();
        var pairs = new Dictionary<SerializationRecordId, SerializationRecordId>();
        var stack = new Stack<(SerializationRecord L, SerializationRecord R, string Path)>();
        stack.Push((a, b, a.TypeName.Name));
        void Diff(string path, object? l, object? r)
        {
            if (differences.Count < maxDifferences) differences.Add(new(path, Show(l), Show(r)));
        }
        while (stack.Count > 0 && differences.Count < maxDifferences)
        {
            var (l, r, path) = stack.Pop();
            // The same left record must always pair with the same right record (shared references keep their shape).
            if (pairs.TryGetValue(l.Id, out var seen)) { if (!seen.Equals(r.Id)) Diff(path, "shared reference", "different reference"); continue; }
            pairs[l.Id] = r.Id;
            if ((l.RecordType != r.RecordType && !(l is ClassRecord && r is ClassRecord)) || l.TypeName.AssemblyQualifiedName != r.TypeName.AssemblyQualifiedName)
            { Diff(path, $"{l.RecordType} {l.TypeName.FullName}", $"{r.RecordType} {r.TypeName.FullName}"); continue; }
            switch (l)
            {
                case PrimitiveTypeRecord pl when r is PrimitiveTypeRecord pr:
                    if (!Equals(pl.Value, pr.Value)) Diff(path, pl.Value, pr.Value);
                    break;
                case ClassRecord cl when r is ClassRecord cr:
                    if (!cl.MemberNames.SequenceEqual(cr.MemberNames)) { Diff(path, string.Join(",", cl.MemberNames), string.Join(",", cr.MemberNames)); break; }
                    foreach (string member in cl.MemberNames)
                    {
                        if (ignore.Contains(member)) continue;
                        object? lv = cl.GetRawValue(member), rv = cr.GetRawValue(member);
                        Value($"{path}.{member}", lv, rv);
                    }
                    break;
                case ArrayRecord al when r is ArrayRecord ar:
                    if (!al.Lengths.SequenceEqual(ar.Lengths)) { Diff(path, $"length {string.Join("x", al.Lengths.ToArray())}", $"length {string.Join("x", ar.Lengths.ToArray())}"); break; }
                    if (al is SZArrayRecord<SerializationRecord> rl && ar is SZArrayRecord<SerializationRecord> rr)
                    {
                        var li = rl.GetArray(); var ri = rr.GetArray();
                        for (int i = 0; i < li.Length; i++) Value($"{path}[{i}]", li[i], ri[i]);
                    }
                    else
                    {
                        // SZArrayRecord<T> of primitives or strings: compare the materialized T[].
                        var li = Materialize(al); var ri = Materialize(ar);
                        if (li == null || ri == null) Diff(path, $"unsupported array {al.GetType().Name}", ar.GetType().Name);
                        else if (!System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(li, ri)) Diff(path, "array content", "different array content");
                    }
                    break;
                default:
                    Diff(path, l.GetType().Name, r.GetType().Name);
                    break;
            }
        }
        return differences;

        void Value(string path, object? lv, object? rv)
        {
            if (lv is SerializationRecord lr && rv is SerializationRecord rr) stack.Push((lr, rr, path));
            else if (lv is SerializationRecord || rv is SerializationRecord || !Equals(lv, rv)) Diff(path, lv, rv);
        }
    }

    // SZArrayRecord<T>.GetArray(bool allowNulls); T is a primitive or string here.
    private static Array? Materialize(ArrayRecord array) =>
        array.GetType().GetMethod("GetArray", [typeof(bool)])?.Invoke(array, [true]) as Array;

    private static string Show(object? value) => value switch
    {
        null => "null",
        SerializationRecord r => $"<{r.TypeName.FullName}>",
        _ => value.ToString() ?? ""
    };

    private static SerializationRecord Decode(byte[] payload)
    {
        if (payload.Length > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        using var stream = new MemoryStream(payload, false);
        var root = NrbfDecoder.Decode(stream, out _, leaveOpen: true);
        if (stream.Position != stream.Length) throw new InvalidDataException("Trailing data after NRBF message.");
        return root;
    }
}
