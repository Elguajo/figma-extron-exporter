using System.Security.Cryptography;
using System.Text.Json;
using ExtronExporter.Format;

try
{
    if (args.Length < 2 || args[0] is not ("inspect" or "repack" or "set-button-text") ||
        (args[0] == "inspect" && args.Length != 2) || (args[0] == "repack" && args.Length != 3) ||
        (args[0] == "set-button-text" && (args.Length != 6 || !int.TryParse(args[3], out _))))
    {
        Console.Error.WriteLine("Usage: inspect <input.gdl|glt> | repack <input> <new-output> | set-button-text <input> <new-output> <button-id> <expected-text> <new-text>");
        return 2;
    }
    var container = ExtronContainer.ReadFile(args[1]);
    var inspection = ProjectInspection.Inspect(container.Payload);
    if (args[0] == "inspect")
    {
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            input = Path.GetFullPath(args[1]),
            container = "KP-single-entry-v1",
            entry = container.EntryName,
            compression = container.CompressionMethod,
            payloadBytes = container.Payload.Length,
            payloadSha256 = Convert.ToHexString(SHA256.HashData(container.Payload)),
            project = inspection,
            validation = "container + NRBF decode; GUI Designer not verified"
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
    else if (args[0] == "repack")
    {
        byte[] output = container.Repack();
        var check = ExtronContainer.Parse(output);
        if (!check.Payload.AsSpan().SequenceEqual(container.Payload)) throw new InvalidDataException("Repack changed payload.");
        using (var file = new FileStream(args[2], FileMode.CreateNew, FileAccess.Write)) file.Write(output);
        Console.WriteLine(JsonSerializer.Serialize(new { output = Path.GetFullPath(args[2]), bytes = output.Length, payloadUnchanged = true, guiDesignerVerified = false }));
    }
    else
    {
        var edit = ButtonTextEditor.Edit(container.Payload, int.Parse(args[3]), args[4], args[5]);
        byte[] output = container.RepackWithPayload(edit.Payload);
        var check = ExtronContainer.Parse(output);
        if (!check.Payload.AsSpan().SequenceEqual(edit.Payload)) throw new InvalidDataException("Packaging changed edited payload.");
        using (var file = new FileStream(args[2], FileMode.CreateNew, FileAccess.Write)) file.Write(output);
        Console.WriteLine(JsonSerializer.Serialize(new {
            output = Path.GetFullPath(args[2]), bytes = output.Length, edit.ButtonId, edit.ButtonName,
            edit.StateCount, edit.OldText, edit.NewText, edit.Patches,
            payloadSha256 = Convert.ToHexString(SHA256.HashData(edit.Payload)),
            preserved = "All bytes outside selected NRBF string values; record IDs; all other decoded class members",
            guiDesignerVerified = false
        }, new JsonSerializerOptions { WriteIndented = true }));
    }
    return 0;
}
catch (Exception e) when (e is IOException or InvalidDataException or UnauthorizedAccessException or ArgumentException or NotSupportedException or System.Runtime.Serialization.SerializationException)
{
    Console.Error.WriteLine($"ERROR: {e.Message}");
    return 1;
}
