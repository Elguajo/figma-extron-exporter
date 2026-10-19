using System.Formats.Nrbf;

namespace ExtronExporter.Format;

public static class ProjectInspection
{
    public static object Inspect(byte[] payload)
    {
        using var stream = new MemoryStream(payload, writable: false);
        var decoded = NrbfDecoder.Decode(stream, out var records, leaveOpen: true);
        if (decoded is not ClassRecord root || root.TypeName.FullName is not
            ("Extron.GUICPro.PBProject" or "Extron.GUICPro.PBTemplate"))
            throw new InvalidDataException("Expected an Extron project/template root record.");
        if (stream.Position != stream.Length) throw new InvalidDataException("Trailing data after NRBF message.");
        var classes = records.Values.OfType<ClassRecord>().ToArray();
        return new
        {
            rootType = root.TypeName.FullName,
            rootMembers = root.MemberNames.ToArray(),
            recordCount = records.Count,
            classCounts = classes.GroupBy(c => c.TypeName.FullName).OrderBy(g => g.Key)
                .ToDictionary(g => g.Key, g => g.Count()),
            controls = classes.Where(c => c.TypeName.FullName is "Extron.GUICPro.PBPage" or
                "Extron.GUICPro.PBButton" or "Extron.GUICPro.PBLabel" or "Extron.GUICPro.PBLevel")
                .Select(c => new
                {
                    type = c.TypeName.FullName,
                    fields = c.MemberNames.Where(n => n is "nameField" or "userIdField" or "widthField" or "heightField" ||
                        n.EndsWith("+nameField", StringComparison.Ordinal) || n.EndsWith("+userIdField", StringComparison.Ordinal) ||
                        n.EndsWith("+widthField", StringComparison.Ordinal) || n.EndsWith("+heightField", StringComparison.Ordinal))
                        .ToDictionary(n => n, n => Describe(c.GetRawValue(n)))
                }).ToArray()
        };
    }

    private static object? Describe(object? value) => value switch
    {
        null => null,
        SerializationRecord r => new { recordType = r.RecordType.ToString(), type = r.TypeName.FullName },
        string or bool or byte or sbyte or short or ushort or int or uint or long or ulong or float or double or decimal => value,
        _ => value.GetType().FullName
    };
}
