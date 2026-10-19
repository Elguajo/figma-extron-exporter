using System.Formats.Nrbf;

namespace ExtronExporter.Format;

/// <summary>
/// Read-only view of the parts of a PBProject graph the generator writes and the verifier checks.
/// Decoded with the Microsoft NRBF reader only: no Extron assembly, no BinaryFormatter.
/// </summary>
public sealed record ProjectModel(
    string RootType, string Name, string AppVersion, ulong? Checksum, ushort DefaultPage,
    BuildInfo Build, PlatformProfile Platform, IReadOnlyList<ContainerModel> Pages, IReadOnlyList<ContainerModel> Popups,
    IReadOnlyList<ResourceModel> Resources, string? ProjectId = null, IReadOnlyList<GroupModel>? Groups = null)
{
    public static ProjectModel Read(byte[] payload)
    {
        if (payload.Length > ExtronContainer.MaxPayloadBytes) throw new InvalidDataException("Payload too large.");
        using var stream = new MemoryStream(payload, false);
        if (NrbfDecoder.Decode(stream, out _, leaveOpen: true) is not ClassRecord root || stream.Position != stream.Length)
            throw new InvalidDataException("Expected one complete NRBF class graph.");
        if (root.TypeName.FullName != "Extron.GUICPro.PBProject") throw new InvalidDataException($"Root is {root.TypeName.FullName}, expected PBProject.");
        var platform = Nrbf.Class(root, "platformField") ?? throw new InvalidDataException("Project has no platform.");
        var size = Nrbf.Class(root, "screenSizeField") ?? throw new InvalidDataException("Project has no screen size.");
        var profile = new PlatformProfile(Nrbf.ShortName(platform), Nrbf.EnumValue(root, "platformTypeField"),
            Nrbf.String(platform, "partNumberField"), Nrbf.Int(size, "width"), Nrbf.Int(size, "height"),
            Nrbf.Int(platform, "horizontalResolutionField"), Nrbf.Int(platform, "verticalResolutionField"));
        var resources = Nrbf.List(Nrbf.Class(Nrbf.Class(root, "resourceSetField"), "resourcesField"))
            .Select(r => new ResourceModel(Nrbf.ShortName(r), Nrbf.String(r, "nameField") ?? "",
                Nrbf.Has(r, "widthField") ? Nrbf.Int(r, "widthField") : null, Nrbf.Has(r, "heightField") ? Nrbf.Int(r, "heightField") : null))
            .ToArray();
        return new(root.TypeName.FullName, Nrbf.String(root, "nameField") ?? "", Nrbf.String(root, "applicationBuildVersionInfoField") ?? "",
            root.GetRawValue("checksum") as ulong?, (ushort)(Nrbf.Primitive(root, "defaultPageField") ?? 0),
            new BuildInfo(Nrbf.EnumValue(root, "buildStatusField"), Nrbf.Primitive(root, "versionInfoField")?.ToString(),
                Nrbf.Primitive(root, "revisionDateField") is DateTime revised ? revised : null),
            profile, ReadContainers(Nrbf.Class(root, "pagesField")), ReadContainers(Nrbf.Class(root, "popupPagesField")), resources,
            Nrbf.String(root, "idField"),
            Nrbf.List(Nrbf.Class(root, "popupPageGroupsField")).Select(g => new GroupModel(Nrbf.String(g, "nameField") ?? "",
                Convert.ToUInt16(Nrbf.Primitive(g, "idField")), Nrbf.Int(g, "referenceCountField"), Nrbf.Int(g, "indexField"))).ToArray());
    }

    private static IReadOnlyList<ContainerModel> ReadContainers(ClassRecord? list) =>
        Nrbf.List(list).Select(p => new ContainerModel(Nrbf.ShortName(p), Nrbf.ULong(p, "idField"), Nrbf.ControlId(p),
            Nrbf.String(p, "nameField") ?? "", Nrbf.String(p, "commentsField"), Nrbf.Int(p, "widthField"), Nrbf.Int(p, "heightField"),
            Nrbf.Color(p, "backgroundFillColorField"),
            Nrbf.List(Nrbf.Class(p, "controlsField")).Select(ReadControl).ToArray(), ReadPopup(p))).ToArray();

    private static PopupInfo? ReadPopup(ClassRecord p) => Nrbf.ShortName(p) != "PBPopupPage" ? null : new(
        (bool)Nrbf.Primitive(p, "modalField")!, Convert.ToUInt16(Nrbf.Primitive(p, "groupIDField")), Nrbf.String(p, "groupNameField"),
        (bool)Nrbf.Primitive(p, "hasReferencesField")!,
        Nrbf.List(Nrbf.Class(p, "popupReferencesField")).Select(r => new ObjectReference(Nrbf.String(r, "projectIDField"),
            Nrbf.ULong(r, "pageIDField"), Nrbf.ULong(r, "popupPageIDField"), Nrbf.ULong(r, "objectIDField"), Nrbf.EnumValue(r, "objectTypeField"))).ToArray());

    private static ControlModel ReadControl(ClassRecord c)
    {
        var states = Nrbf.States(c).Select(s => new StateModel(Nrbf.String(s, "nameField") ?? "", Nrbf.ULong(s, "idField"),
            Nrbf.Int(s, "indexField"), Nrbf.String(s, "textField"), Nrbf.ImageName(s, "buttonImageField"),
            Nrbf.Color(s, "borderFillColorField"), Nrbf.Color(s, "textColorField"), Nrbf.ImageId(s))).ToArray();
        LevelModel? level = Nrbf.ShortName(c) == "PBLevel"
            ? new(Nrbf.EnumValue(c, "displayTypeField"), Nrbf.EnumValue(c, "orientationField"),
                (uint)(Nrbf.Primitive(c, "minValueField") ?? 0u), (uint)(Nrbf.Primitive(c, "maxValueField") ?? 0u), Nrbf.Color(c, "gaugeFillColorField"))
            : null;
        int? press = Nrbf.Has(c, "<TLPPressFeedbackStateID>k__BackingField") ? Nrbf.Int(c, "<TLPPressFeedbackStateID>k__BackingField") : null;
        PopupBinding? binding = null;
        if (Nrbf.ShortName(c) == "PBPopupPageReference" && Nrbf.Class(c, "popupPageIDField") is { } id)
            binding = new(Nrbf.ULong(id, "popupIDField"), Convert.ToUInt16(Nrbf.Primitive(id, "groupIDField")), Nrbf.String(id, "popupNameField"),
                Nrbf.String(id, "groupNameField"), (bool)Nrbf.Primitive(c, "modalField")!);
        return new(Nrbf.ShortName(c), Nrbf.ULong(c, "idField"), Nrbf.ControlId(c), Nrbf.String(c, "nameField") ?? "",
            Nrbf.String(c, "commentsField"), Nrbf.Int(c, "leftField"), Nrbf.Int(c, "topField"), Nrbf.Int(c, "widthField"), Nrbf.Int(c, "heightField"),
            Nrbf.String(c, "textField"), Nrbf.Color(c, "textColorField"), states, level, press, Nrbf.ImageId(c), binding);
    }
}

/// <summary>
/// Build bookkeeping. GUI Designer's Build assigns TLPImageID artwork numbers (the generator writes -1);
/// BuildStatusEnum is stored as a number only.
/// </summary>
public sealed record BuildInfo(int StatusValue, string? VersionInfo, DateTime? RevisionDate);

/// <summary>Platform as stored: class name, PlatformProTypeEnum numeric value, part number and resolutions.</summary>
public sealed record PlatformProfile(string PlatformClass, int PlatformTypeValue, string? PartNumber,
    int ScreenWidth, int ScreenHeight, int PlatformWidth, int PlatformHeight);

public sealed record ContainerModel(string Type, ulong ObjectId, ushort ControlId, string Name, string? Comments,
    int Width, int Height, uint? Background, IReadOnlyList<ControlModel> Controls, PopupInfo? Popup = null);

/// <summary>Popup page specifics. References are the back-pointers to the controls that place the popup.</summary>
public sealed record PopupInfo(bool Modal, ushort GroupId, string? GroupName, bool HasReferences, IReadOnlyList<ObjectReference> References);

/// <summary>PBObjectReference: popupPageId is ulong.MaxValue when the referencing control sits on a page.</summary>
public sealed record ObjectReference(string? ProjectId, ulong PageId, ulong PopupPageId, ulong ObjectId, int ObjectType);

/// <summary>PBPopupPageReference binding: a popup ID (groupId 0) or a group (popupId = ulong.MaxValue).</summary>
public sealed record PopupBinding(ulong PopupId, ushort GroupId, string? PopupName, string? GroupName, bool Modal);

/// <summary>Entry of PBProject.popupPageGroupsField.</summary>
public sealed record GroupModel(string Name, ushort Id, int ReferenceCount, int Index);

public sealed record ControlModel(string Type, ulong ObjectId, ushort ControlId, string Name, string? Comments,
    int Left, int Top, int Width, int Height, string? Text, uint? TextColor, IReadOnlyList<StateModel> States,
    LevelModel? Level, int? PressFeedbackState, int? TlpImageId, PopupBinding? PopupBinding = null);

public sealed record StateModel(string Name, ulong Id, int Index, string? Text, string? Image, uint? Fill, uint? TextColor, int? TlpImageId);

public sealed record LevelModel(int DisplayType, int Orientation, uint Min, uint Max, uint? Fill);

public sealed record ResourceModel(string Type, string Name, int? Width, int? Height);

/// <summary>Member access tolerant of BinaryFormatter's "BaseClass+field" naming for inherited fields.</summary>
internal static class Nrbf
{
    public static string ShortName(ClassRecord r) { var n = r.TypeName.FullName; int i = n.LastIndexOf('.'); return i < 0 ? n : n[(i + 1)..]; }

    public static bool Has(ClassRecord r, string name) => Find(r, name) != null;

    private static string? Find(ClassRecord r, string name)
    {
        if (r.HasMember(name)) return name;
        var matches = r.MemberNames.Where(m => m.EndsWith("+" + name, StringComparison.Ordinal)).ToArray();
        return matches.Length switch
        {
            0 => null,
            1 => matches[0],
            _ => throw new InvalidDataException($"Member {name} is ambiguous on {r.TypeName.FullName}.")
        };
    }

    private static string Member(ClassRecord r, string name) =>
        Find(r, name) ?? throw new InvalidDataException($"{r.TypeName.FullName} has no member {name}.");

    public static object? Primitive(ClassRecord r, string name) => r.GetRawValue(Member(r, name)) switch
    {
        SerializationRecord => throw new InvalidDataException($"{name} is not a primitive."),
        var v => v
    };

    public static int Int(ClassRecord r, string name) => Convert.ToInt32(Primitive(r, name) ?? throw new InvalidDataException($"{name} is null."));
    public static ulong ULong(ClassRecord r, string name) => Convert.ToUInt64(Primitive(r, name) ?? throw new InvalidDataException($"{name} is null."));
    public static string? String(ClassRecord r, string name) => Find(r, name) is { } m ? r.GetString(m) : null;
    public static ClassRecord? Class(ClassRecord? r, string name) => r == null ? null : r.GetClassRecord(Member(r, name));

    /// <summary>Every userIdField along the inheritance chain must agree (the editor stores more than one).</summary>
    public static ushort ControlId(ClassRecord r)
    {
        var values = r.MemberNames.Where(m => m == "userIdField" || m.EndsWith("+userIdField", StringComparison.Ordinal))
            .Select(m => r.GetRawValue(m)).Distinct().ToArray();
        if (values.Length != 1 || values[0] is not ushort id) throw new InvalidDataException($"Inconsistent userIdField on {r.TypeName.FullName}.");
        return id;
    }

    public static int EnumValue(ClassRecord r, string name)
    {
        var e = Class(r, name) ?? throw new InvalidDataException($"{name} is null.");
        return Convert.ToInt32(e.GetRawValue("value__"));
    }

    /// <summary>ARGB of a PBColor, or null for no color / palette or named color.</summary>
    public static uint? Color(ClassRecord r, string name)
    {
        if (Find(r, name) is not { } m || r.GetClassRecord(m) is not { } pb) return null;
        if (pb.GetRawValue("paletteIndexField") is int palette && palette >= 0) return null;
        if (pb.GetClassRecord("valueField") is not { } color) return null;
        // System.Drawing.Color.state: 2 = ARGB value valid; 1 = known color.
        return Convert.ToInt16(color.GetRawValue("state")) == 2 ? unchecked((uint)Convert.ToInt64(color.GetRawValue("value"))) : null;
    }

    public static int? ImageId(ClassRecord r) =>
        Has(r, "<TLPImageID>k__BackingField") ? Int(r, "<TLPImageID>k__BackingField") : null;

    public static string? ImageName(ClassRecord r, string name) =>
        Find(r, name) is { } m && r.GetClassRecord(m) is { } reference ? String(reference, "resourceNameField") : null;

    public static IReadOnlyList<ClassRecord> List(ClassRecord? list)
    {
        if (list == null) return [];
        int size = list.GetInt32("_size");
        if (list.GetArrayRecord("_items") is not SZArrayRecord<SerializationRecord> items) throw new InvalidDataException("Unsupported list layout.");
        var slots = items.GetArray();
        if (size < 0 || size > slots.Length) throw new InvalidDataException("List size exceeds its array.");
        var result = slots.Take(size).Select(s => s as ClassRecord ?? throw new InvalidDataException("List element is not an object.")).ToArray();
        return result;
    }

    public static IReadOnlyList<ClassRecord> States(ClassRecord c) =>
        Find(c, "statesField") is { } m && c.GetClassRecord(m) is { } states ? List(states.GetClassRecord("mItems")) : [];
}
