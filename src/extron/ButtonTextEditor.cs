using System.Buffers.Binary;
using System.Formats.Nrbf;
using System.Text;

namespace ExtronExporter.Format;

/// <summary>Experimental, conservative edit of existing plain-text button states. No Extron objects are instantiated.</summary>
public static class ButtonTextEditor
{
    public sealed record TextPatch(int Offset, int OriginalBytes, int NewBytes, int StringObjectId);
    public sealed record EditResult(byte[] Payload, int ButtonId, string ButtonName, int StateCount,
        string OldText, string NewText, IReadOnlyList<TextPatch> Patches);

    public static EditResult Edit(byte[] payload, int buttonId, string expectedText, string newText)
    {
        try { return EditCore(payload, buttonId, expectedText, newText); }
        catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or InvalidCastException)
        { throw new NotSupportedException("Project members do not match the supported button/state layout.", e); }
    }

    private static EditResult EditCore(byte[] payload, int buttonId, string expectedText, string newText)
    {
        if (buttonId is <= 0 or > ushort.MaxValue || string.IsNullOrEmpty(expectedText) || string.IsNullOrEmpty(newText) || expectedText == newText)
            throw new ArgumentException("Require a positive button ID and different, non-empty old/new text.");
        // Strict encoder rejects unpaired surrogates instead of silently replacing them.
        var utf8 = new UTF8Encoding(false, true);
        if (utf8.GetByteCount(newText) > 4096 || newText.Contains('\0'))
            throw new ArgumentException("New label must be at most 4096 UTF-8 bytes and contain no NUL.");
        var (root, records) = Decode(payload);
        if (root.TypeName.FullName != "Extron.GUICPro.PBProject" || root.GetString("applicationBuildVersionInfoField") != "1.28.0.7")
            throw new NotSupportedException("Text edits currently require a GUI Designer 1.28.0.7 PBProject.");
        if (root.GetRawValue("checksum") is not ulong checksum || checksum != 0)
            throw new NotSupportedException("Nonzero or unknown project checksum is not supported.");
        var buttons = records.Values.OfType<ClassRecord>().Where(c => c.TypeName.FullName == "Extron.GUICPro.PBButton" &&
            c.GetRawValue("userIdField") is ushort id && id == buttonId).ToArray();
        if (buttons.Length != 1) throw new InvalidDataException("Button ID must select exactly one button.");
        var button = buttons[0];
        foreach (string member in button.MemberNames.Where(n => n.EndsWith("userIdField", StringComparison.Ordinal)))
            if (!Equals(button.GetRawValue(member), (ushort)buttonId)) throw new InvalidDataException("Inherited button IDs disagree.");
        if (button.GetRawValue("PBControl+textField") != null || button.GetRawValue("PBControl+ftextField") != null)
            throw new NotSupportedException("Button-level text override is not supported.");
        var collection = button.GetClassRecord("PBControlBase+statesField") ?? throw new NotSupportedException("Missing states collection.");
        var stateList = collection.GetClassRecord("mItems") ?? throw new NotSupportedException("Missing states list.");
        int count = stateList.GetInt32("_size");
        if (stateList.GetArrayRecord("_items") is not SZArrayRecord<SerializationRecord> items || count is < 1 or > 256)
            throw new NotSupportedException("Unsupported button states collection.");
        var slots = items.GetArray();
        if (count > slots.Length) throw new InvalidDataException("State count exceeds array length.");
        var states = slots.Take(count).OfType<ClassRecord>().ToArray();
        if (states.Length != count || states.Select(s => s.Id).Distinct().Count() != count ||
            states.Any(s => s.TypeName.FullName != "Extron.GUICPro.PBState" || s.GetString("textField") != expectedText || s.GetRawValue("ftextField") != null))
            throw new NotSupportedException("All states must have the expected plain-text label and no formatted text.");
        var strings = states.Select(s => s.GetSerializationRecord("textField")!).DistinctBy(s => s.Id).ToArray();
        if (strings.Any(s => s.RecordType != SerializationRecordType.BinaryObjectString))
            throw new NotSupportedException("Expected referenced BinaryObjectString labels.");
        var targetIds = strings.Select(s => s.Id).ToHashSet();
        var stateIds = states.Select(s => s.Id).ToHashSet();
        // A state or string shared with another control would change more than one button.
        foreach (var c in records.Values.OfType<ClassRecord>())
            foreach (string name in c.MemberNames)
            {
                object? value = c.GetRawValue(name);
                if (value is SerializationRecord reference &&
                    ((reference.Id.Equals(collection.Id) && !(c.Id.Equals(button.Id) && name == "PBControlBase+statesField")) ||
                     (reference.Id.Equals(stateList.Id) && !(c.Id.Equals(collection.Id) && name == "mItems")) ||
                     (reference.Id.Equals(items.Id) && !(c.Id.Equals(stateList.Id) && name == "_items")) ||
                     stateIds.Contains(reference.Id)))
                    throw new NotSupportedException("Button states collection is shared outside its expected ownership path.");
                if (value is string && c.GetSerializationRecord(name) is { } str && targetIds.Contains(str.Id) &&
                    !(stateIds.Contains(c.Id) && name == "textField"))
                    throw new NotSupportedException("Label string is shared outside the selected button states.");
            }
        foreach (var array in records.Values.OfType<ArrayRecord>())
        {
            if (array is SZArrayRecord<SerializationRecord> refs)
            {
                foreach (var item in refs.GetArray())
                    if (item != null && (targetIds.Contains(item.Id) || item.Id.Equals(collection.Id) || item.Id.Equals(stateList.Id) || item.Id.Equals(items.Id) ||
                        (stateIds.Contains(item.Id) && !array.Id.Equals(items.Id))))
                        throw new NotSupportedException("State or label is shared through another array.");
            }
            else if (array is SZArrayRecord<string> texts && texts.GetArray().Contains(expectedText))
                throw new NotSupportedException("Matching text in a string array needs a dedicated ownership check.");
            else if (array is not (SZArrayRecord<string> or SZArrayRecord<byte> or SZArrayRecord<sbyte> or
                SZArrayRecord<short> or SZArrayRecord<ushort> or SZArrayRecord<int> or SZArrayRecord<uint> or
                SZArrayRecord<long> or SZArrayRecord<ulong> or SZArrayRecord<float> or SZArrayRecord<double> or
                SZArrayRecord<bool> or SZArrayRecord<char> or SZArrayRecord<decimal> or SZArrayRecord<DateTime> or SZArrayRecord<TimeSpan>))
                throw new NotSupportedException("Array layout requires additional ownership checks.");
        }
        byte[] oldValue = EncodeString(expectedText), newValue = EncodeString(newText);
        var patches = new List<TextPatch>();
        for (int p = 17; p <= payload.Length - 5 - oldValue.Length; p++)
        {
            if (payload[p] != 6 || !payload.AsSpan(p + 5, oldValue.Length).SequenceEqual(oldValue)) continue;
            int id = BinaryPrimitives.ReadInt32LittleEndian(payload.AsSpan(p + 1, 4));
            if (id <= 0) continue;
            // Public decoder ID is deliberately opaque. Decode a standalone string record to compare IDs,
            // rather than relying on its hash code or private runtime fields.
            using var candidate = new MemoryStream();
            using (var writer = new BinaryWriter(candidate, utf8, true))
            {
                writer.Write((byte)0); writer.Write(id); writer.Write(-1); writer.Write(1); writer.Write(0);
                writer.Write(payload, p, 5 + oldValue.Length); writer.Write((byte)11);
            }
            candidate.Position = 0;
            if (targetIds.Contains(NrbfDecoder.Decode(candidate).Id))
                patches.Add(new(p + 5, oldValue.Length, newValue.Length, id));
        }
        if (patches.Count != strings.Length || patches.Select(p => p.StringObjectId).Distinct().Count() != strings.Length)
            throw new InvalidDataException("String record location is missing or ambiguous.");
        long resultSize = payload.Length + (long)patches.Count * (newValue.Length - oldValue.Length);
        if (resultSize > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Edited payload exceeds size limit.");
        using var output = new MemoryStream((int)resultSize);
        int start = 0;
        foreach (var patch in patches.OrderBy(p => p.Offset))
        {
            output.Write(payload, start, patch.Offset - start); output.Write(newValue);
            start = patch.Offset + patch.OriginalBytes;
        }
        output.Write(payload, start, payload.Length - start);
        byte[] result = output.ToArray();
        var (_, after) = Decode(result);
        if (after.Count != records.Count || records.Keys.Any(id => !after.ContainsKey(id)))
            throw new InvalidDataException("Edit changed record identities.");
        foreach (var c in records.Values.OfType<ClassRecord>())
        {
            if (after[c.Id] is not ClassRecord next || next.TypeName.AssemblyQualifiedName != c.TypeName.AssemblyQualifiedName || !next.MemberNames.SequenceEqual(c.MemberNames))
                throw new InvalidDataException("Edit changed class metadata.");
            foreach (string member in c.MemberNames)
            {
                object? beforeValue = c.GetRawValue(member), afterValue = next.GetRawValue(member);
                bool same = stateIds.Contains(c.Id) && member == "textField" ? Equals(afterValue, newText) :
                    beforeValue is SerializationRecord b && afterValue is SerializationRecord a ? b.Id.Equals(a.Id) : Equals(beforeValue, afterValue);
                if (!same) throw new InvalidDataException($"Unexpected change to {c.TypeName.FullName}.{member}.");
            }
        }
        return new(result, buttonId, button.GetString("PBControlBase+nameField")!, count, expectedText, newText, patches);
    }

    private static (ClassRecord Root, IReadOnlyDictionary<SerializationRecordId, SerializationRecord> Records) Decode(byte[] payload)
    {
        if (payload.Length > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        using var stream = new MemoryStream(payload, false);
        if (NrbfDecoder.Decode(stream, out var records, leaveOpen: true) is not ClassRecord root || stream.Position != stream.Length)
            throw new InvalidDataException("Expected one complete NRBF class graph.");
        return (root, records);
    }

    private static byte[] EncodeString(string value)
    {
        using var stream = new MemoryStream();
        using (var writer = new BinaryWriter(stream, new UTF8Encoding(false, true), true)) writer.Write(value);
        return stream.ToArray();
    }
}
