using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using ExtronExporter.Format;

// Positional: [real-gdl] [templates-dir]. Options: --built <gui-saved.gdl> --registry <donors.json>
// --gui-built-screens <folder with GUI-built first-screen-*.gdl> --integration
var flags = new Dictionary<string, string?>();
var positional = new List<string>();
for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--integration") flags[args[i]] = null;
    else if (args[i] is "--built" or "--registry" or "--gui-built-screens" && i + 1 < args.Length) flags[args[i]] = args[++i];
    else if (args[i].StartsWith("--", StringComparison.Ordinal)) { Console.Error.WriteLine($"Unknown option {args[i]}"); return 2; }
    else positional.Add(args[i]);
}
args = positional.ToArray();
int passed = 0, failed = 0;
void Test(string name, Action action)
{
    try { action(); passed++; Console.WriteLine($"PASS {name}"); }
    catch (Exception e) { failed++; Console.WriteLine($"FAIL {name}: {e.Message}"); }
}
void Check(bool valid) { if (!valid) throw new Exception("Assertion failed"); }
void Reject(byte[] bytes)
{
    try { ExtronContainer.Parse(bytes); }
    catch (InvalidDataException) { return; }
    throw new Exception("Expected InvalidDataException");
}
byte[] payload = Encoding.UTF8.GetBytes("Музыка / 123456789 / source-state\0");
byte[] Fixture(CompressionLevel level = CompressionLevel.Optimal)
{
    using var stream = new MemoryStream();
    using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
    using (var entry = zip.CreateEntry("ProjectGCP", level).Open()) entry.Write(payload);
    var data = stream.ToArray();
    int end = data.Length - 22;
    int central = (int)BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(end + 16));
    foreach (int pos in new[] { 0, central, end }) { data[pos] = (byte)'K'; data[pos + 1] = (byte)'P'; }
    return data;
}
int Central(byte[] b) => (int)BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(b.Length - 6));
void Put32(byte[] b, int pos, uint value) => BinaryPrimitives.WriteUInt32LittleEndian(b.AsSpan(pos), value);

Test("CRC32 standard check vector", () => Check(ExtronContainer.Crc32("123456789"u8) == 0xCBF43926));
Test("DEFLATE from standard ZIP writer", () => Check(ExtronContainer.Parse(Fixture()).Payload.SequenceEqual(payload)));
Test("Stored entry", () => Check(ExtronContainer.Parse(Fixture(CompressionLevel.NoCompression)).Payload.SequenceEqual(payload)));
Test("Repack preserves payload and supports a second repack", () =>
{
    var a = ExtronContainer.Parse(Fixture());
    var b = ExtronContainer.Parse(a.Repack());
    Check(ExtronContainer.Parse(b.Repack()).Payload.SequenceEqual(payload));
});
Test("Reject truncated container", () => Reject(Fixture()[..^1]));
Test("Reject wrong local signature", () => { var b = Fixture(); b[0] = 0; Reject(b); });
Test("Reject central directory outside file", () => { var b = Fixture(); Put32(b, b.Length - 6, 0xfffffff0); Reject(b); });
Test("Reject mismatched metadata", () => { var b = Fixture(); b[14] ^= 1; Reject(b); });
Test("Reject payload corruption even with consistent stored sizes", () =>
{
    var b = Fixture(CompressionLevel.NoCompression); int start = 30 + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(26)) + BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(28));
    b[start] ^= 1; Reject(b);
});
Test("Reject oversized declared payload before allocating", () =>
{
    var b = Fixture(); Put32(b, Central(b) + 24, ExtronContainer.MaxPayloadBytes + 1u); Reject(b);
});
Test("Reject encrypted/data-descriptor flags", () => { var b = Fixture(); b[Central(b) + 8] |= 1; Reject(b); });
Test("Reject expansion beyond declared size", () =>
{
    var b = Fixture(); Put32(b, 22, 1); Put32(b, Central(b) + 24, 1); Reject(b);
});
Test("Reject expansion shorter than declared size", () =>
{
    var b = Fixture(); Put32(b, 22, (uint)payload.Length + 1); Put32(b, Central(b) + 24, (uint)payload.Length + 1); Reject(b);
});
Test("Reject foreign entry name", () => { var b = Fixture(); b[30] = (byte)'X'; b[Central(b) + 46] = (byte)'X'; Reject(b); });
Test("Reject multi-entry declaration", () => { var b = Fixture(); b[^12] = 2; Reject(b); });
Test("Reject non-NRBF data", () =>
{
    try { ProjectInspection.Inspect(payload); }
    catch (System.Runtime.Serialization.SerializationException) { return; }
    throw new Exception("Expected invalid NRBF rejection");
});
// Small independent NRBF graph: two states with distinct string records.
// No BinaryFormatter or application DLLs are used to create fixtures.
byte[] ButtonFixture(string mode = "normal")
{
    using var stream = new MemoryStream();
    using var w = new BinaryWriter(stream, new UTF8Encoding(false, true), true);
    void Ref(int id) { w.Write((byte)9); w.Write(id); }
    void Str(int id, string text) { w.Write((byte)6); w.Write(id); w.Write(text); }
    void Null() => w.Write((byte)10);
    void Class(int id, string type, (string Name, byte Type, byte Primitive)[] fields)
    {
        w.Write((byte)5); w.Write(id); w.Write(type); w.Write(fields.Length);
        foreach (var f in fields) w.Write(f.Name);
        foreach (var f in fields) w.Write(f.Type);
        foreach (var f in fields.Where(f => f.Type == 0)) w.Write(f.Primitive);
        w.Write(3);
    }
    w.Write((byte)0); w.Write(1); w.Write(-1); w.Write(1); w.Write(0);
    w.Write((byte)12); w.Write(3); w.Write("GUI Designer, Version=1.28.0.7, Culture=neutral, PublicKeyToken=null");
    Class(1, "Extron.GUICPro.PBProject", [("applicationBuildVersionInfoField",1,0),("checksum",0,16),("button",2,0),("extra",2,0)]);
    Str(2, mode == "version" ? "1.0" : "1.28.0.7"); w.Write(mode == "checksum" ? 1UL : 0UL); Ref(10); Ref(60);
    Class(10, "Extron.GUICPro.PBButton", [("userIdField",0,14),("PBControl+userIdField",0,14),("PBControl+textField",1,0),
        ("PBControl+ftextField",1,0),("PBControlBase+statesField",2,0),("PBControlBase+nameField",1,0)]);
    w.Write((ushort)8000); w.Write((ushort)(mode == "inherited-id" ? 8001 : 8000)); Null(); Null(); Ref(20); Str(11,"Start");
    Class(20,"Extron.GUICPro.PBStates",[("mItems",2,0)]); Ref(21);
    Class(21,"System.Collections.Generic.List`1",[("_size",0,8),("_items",2,0)]); w.Write(2); Ref(30);
    w.Write((byte)16); w.Write(30); w.Write(2); Ref(40); Ref(41);
    foreach (int id in new[] {40,41})
    {
        Class(id,"Extron.GUICPro.PBState",[("textField",1,0),("ftextField",1,0)]);
        Ref(id == 40 ? 50 : 51); if(mode == "formatted" && id == 40) Ref(52); else Null();
    }
    Str(50,"Press to begin"); Str(51,"Press to begin");
    if(mode == "formatted") Str(52,"formatted");
    Class(60,"Other",[("text",1,0),("states",2,0),("array",2,0)]);
    if(mode == "shared-string") Ref(50); else Null();
    if(mode == "shared-collection") Ref(20); else Null();
    if(mode == "shared-state-array") Ref(61); else Null();
    if(mode == "shared-state-array") { w.Write((byte)16); w.Write(61); w.Write(1); Ref(40); }
    w.Write((byte)11);
    return stream.ToArray();
}
Test("Synthetic button: edits two distinct strings, exact reverse", () =>
{
    byte[] source = ButtonFixture();
    var edit = ButtonTextEditor.Edit(source,8000,"Press to begin","Музыка");
    Check(edit.Patches.Count == 2 && edit.StateCount == 2);
    Check(ButtonTextEditor.Edit(edit.Payload,8000,"Музыка","Press to begin").Payload.SequenceEqual(source));
});
foreach (string mode in new[] {"version","checksum","inherited-id","formatted","shared-string","shared-collection","shared-state-array"})
    Test($"Synthetic button: reject {mode}", () =>
    {
        try { ButtonTextEditor.Edit(ButtonFixture(mode),8000,"Press to begin","Музыка"); }
        catch (Exception e) when (e is InvalidDataException or NotSupportedException) { return; }
        throw new Exception("Expected unsafe/unsupported edit rejection");
    });
if (args.Length > 0)
{
    Test("Real GDL decode + unchanged NRBF after repack", () =>
    {
        var source = ExtronContainer.ReadFile(args[0]);
        ProjectInspection.Inspect(source.Payload);
        var copy = ExtronContainer.Parse(source.Repack());
        Check(source.Payload.SequenceEqual(copy.Payload));
        ProjectInspection.Inspect(copy.Payload);
    });
    void RejectEdit(Action action)
    {
        try { action(); }
        catch (Exception e) when (e is ArgumentException or InvalidDataException or NotSupportedException) { return; }
        throw new Exception("Expected edit rejection");
    }
    var originalPayload = ExtronContainer.ReadFile(args[0]).Payload;
    Test("Button text: Cyrillic, IDs/fields retained, exact reversible byte edit", () =>
    {
        var edit = ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", "Музыка");
        Check(edit.ButtonName == "Start" && edit.ButtonId == 8000 && edit.StateCount == 2 && edit.Patches.Count == 1);
        Check(edit.Payload.Length == originalPayload.Length - 2);
        var back = ButtonTextEditor.Edit(edit.Payload, 8000, "Музыка", "Press to begin");
        Check(back.Payload.SequenceEqual(originalPayload));
        var repacked = ExtronContainer.ReadFile(args[0]).RepackWithPayload(edit.Payload);
        Check(ExtronContainer.Parse(repacked).Payload.SequenceEqual(edit.Payload));
    });
    Test("Button text: length prefix expands past one byte and round trips", () =>
    {
        string text = new('Ж', 200);
        var edit = ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", text);
        Check(ButtonTextEditor.Edit(edit.Payload, 8000, text, "Press to begin").Payload.SequenceEqual(originalPayload));
    });
    Test("Button text: input bytes remain untouched", () =>
    {
        byte[] before = originalPayload.ToArray();
        ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", "Музыка");
        Check(before.SequenceEqual(originalPayload));
    });
    Test("Button text: reject unknown ID", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 65535, "Press to begin", "Музыка")));
    Test("Button text: reject stale expected label", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 8000, "Wrong", "Музыка")));
    Test("Button text: reject no-op", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", "Press to begin")));
    Test("Button text: reject NUL", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", "Музыка\0")));
    Test("Button text: reject invalid Unicode", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", "\uD800")));
    Test("Button text: reject oversized UTF-8", () => RejectEdit(() => ButtonTextEditor.Edit(originalPayload, 8000, "Press to begin", new string('Ж', 2049))));
}
if (args.Length > 1)
{
    foreach (string template in Directory.GetFiles(args[1], "*.glt"))
        Test(Path.GetFileName(template), () =>
        {
            var source = ExtronContainer.ReadFile(template);
            ProjectInspection.Inspect(source.Payload);
            var copy = ExtronContainer.Parse(source.Repack());
            Check(source.Payload.SequenceEqual(copy.Payload));
        });
}
ScreenTests.Container(Test);
ScreenTests.Spec(Test);
ScreenTests.Boundary(Test);
if (flags.TryGetValue("--built", out var built)) ScreenTests.BuiltProject(Test, built!);
if (flags.TryGetValue("--registry", out var registry)) ScreenTests.Registry(Test, registry!);
if (flags.TryGetValue("--gui-built-screens", out var screens))
{
    if (registry == null) { Console.Error.WriteLine("--gui-built-screens needs --registry"); return 2; }
    ScreenTests.GuiBuiltScreens(Test, screens!, registry);
}
if (flags.ContainsKey("--integration"))
{
    if (registry == null) { Console.Error.WriteLine("--integration needs --registry"); return 2; }
    ScreenTests.Integration(Test, registry);
}
Console.WriteLine($"RESULT: {passed} passed, {failed} failed. GUI Designer validation is separate.");
return failed == 0 ? 0 : 1;
