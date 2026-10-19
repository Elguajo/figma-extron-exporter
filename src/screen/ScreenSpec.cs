using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ExtronExporter.Screen;

// Experimental screen description (schema "exui-screen-experiment/0"). Deliberately NOT the .exui
// contract: it exists to prove that one page can be generated from our own data with fixed IDs.

public sealed record ScreenSpec(
    string? Schema, string? Panel, ProjectSpec? Project, PageSpec? Page,
    IReadOnlyList<AssetSpec>? Assets, IReadOnlyList<ElementSpec>? Elements);

public sealed record ProjectSpec(string? Name);

/// <summary>ObjectId is the page's editor ID (idField); GUI Designer also uses it as the page number.</summary>
public sealed record PageSpec(string? Key, int? ObjectId, string? Name, string? Background);

public sealed record AssetSpec(string? Key, string? File, string? ResourceName);

public sealed record FontSpec(string? Family, double? Size, bool? Bold);

/// <summary>
/// ObjectId: editor object ID (PBControlBase.idField), unique within the page.
/// ControlId: Extron ID addressed by the control program (userIdField, UInt16); null means 0 / not addressed.
/// </summary>
public sealed record ElementSpec(
    string? Key, string? Kind, long? ObjectId, int? ControlId, string? Name, int[]? Rect,
    string? Text, string? TextColor, FontSpec? Font,
    IReadOnlyList<StateSpec>? States, string? Press,
    string? Display, string? Orientation, int? Min, int? Max, string? FillColor);

/// <summary>Role: normal (state 0, at rest), pressed (shown while held), feedback (set by the control program).</summary>
public sealed record StateSpec(string? Name, string? Role, string? Text, string? Fill, string? TextColor,
    string? Image, string? ImageAlign, string? TextAlign);

public sealed class ScreenSpecException(IReadOnlyList<string> errors)
    : Exception("Screen description is invalid:\n  " + string.Join("\n  ", errors))
{
    public IReadOnlyList<string> Errors { get; } = errors;
}

// ---- normalized form handed to the adapter (field names match ExtronAdapterHost.ps1) -------------------

public sealed record GeneratePlan(string ProjectName, PlanPage Page, IReadOnlyList<PlanImage> Images, IReadOnlyList<PlanElement> Elements);
public sealed record PlanPage(string Key, int ObjectId, string Name, string? Background);
public sealed record PlanImage(string Key, string ResourceName, string File, int Width, int Height, string Sha256);
public sealed record PlanFont(string? Family, double? Size, bool? Bold);
public sealed record PlanState(string Name, string Role, string Text, string Fill, string TextColor, string? Image, string ImageAlign, string TextAlign);
public sealed record PlanElement(
    string Kind, string Key, ulong ObjectId, int ControlId, string Name, int[] Rect,
    string? Text = null, string? TextColor = null, PlanFont? Font = null,
    IReadOnlyList<PlanState>? States = null, int? PressState = null,
    string? Display = null, string? Orientation = null, int? Min = null, int? Max = null, string? FillColor = null);

public static class ScreenSpecReader
{
    public const string Schema = "exui-screen-experiment/0";
    public const int MaxElements = 64, MaxStates = 8, MaxText = 256, MaxImageBytes = 4 * 1024 * 1024, MaxImageSide = 4096;

    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private static readonly System.Text.UTF8Encoding Strict = new(false, true);
    private static readonly Regex KeyPattern = new("^[a-z][a-z0-9]*([.-][a-z0-9]+)*$", RegexOptions.CultureInvariant);
    private static readonly Regex ColorPattern = new("^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$", RegexOptions.CultureInvariant);
    private static readonly Regex ResourcePattern = new("^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$", RegexOptions.CultureInvariant);

    private static readonly Dictionary<string, string> Alignments = new()
    {
        ["top-left"] = "TopLeft", ["top-center"] = "TopCenter", ["top-right"] = "TopRight",
        ["middle-left"] = "MiddleLeft", ["middle-center"] = "MiddleCenter", ["middle-right"] = "MiddleRight",
        ["bottom-left"] = "BottomLeft", ["bottom-center"] = "BottomCenter", ["bottom-right"] = "BottomRight"
    };
    private static readonly Dictionary<string, string> Orientations = new()
    { ["left-to-right"] = "LeftToRight", ["right-to-left"] = "RightToLeft", ["bottom-to-top"] = "BottomToTop", ["top-to-bottom"] = "TopToBottom" };
    private static readonly Dictionary<string, string> Displays = new() { ["slider"] = "Slider", ["gauge"] = "Gauge" };

    public static ScreenSpec Load(string path)
    {
        try { return JsonSerializer.Deserialize<ScreenSpec>(File.ReadAllText(path), Json) ?? throw new ScreenSpecException(["File is empty."]); }
        catch (JsonException e) { throw new ScreenSpecException([$"JSON: {e.Message}"]); }
    }

    /// <summary>
    /// Validate against the donor's real canvas and resolve assets relative to <paramref name="baseDir"/>.
    /// IDs are taken from the description only; nothing here depends on element order, text or geometry.
    /// </summary>
    public static GeneratePlan Normalize(ScreenSpec spec, string expectedPanel, int canvasWidth, int canvasHeight, string baseDir)
    {
        var errors = new List<string>();
        void Error(string message) => errors.Add(message);

        if (spec.Schema != Schema) Error($"schema: expected \"{Schema}\".");
        if (spec.Panel != expectedPanel) Error($"panel: description targets \"{spec.Panel}\" but the donor is \"{expectedPanel}\". Choose the donor of that panel; a model name alone does not change the project.");
        string projectName = spec.Project?.Name ?? "";
        CheckText(projectName, "project.name", required: true, Error);

        var keys = new HashSet<string>(StringComparer.Ordinal);
        void Key(string? key, string where)
        {
            if (key == null || !KeyPattern.IsMatch(key)) Error($"{where}.key: required, lowercase segments separated by '.' or '-'.");
            else if (!keys.Add(key)) Error($"{where}.key: \"{key}\" is used twice.");
        }

        var page = spec.Page;
        PlanPage? planPage = null;
        if (page == null) Error("page: required.");
        else
        {
            Key(page.Key, "page");
            if (page.ObjectId is not (>= 1 and <= 65534)) Error("page.objectId: required, 1..65534 (stored as a UInt16 start page; 65535 is the Offline page).");
            CheckText(page.Name, "page.name", required: true, Error);
            CheckColor(page.Background, "page.background", required: false, Error);
            planPage = new(page.Key ?? "", page.ObjectId ?? 0, page.Name ?? "", page.Background);
        }

        var images = new Dictionary<string, PlanImage>(StringComparer.Ordinal);
        var resourceNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (asset, i) in (spec.Assets ?? []).Select((a, i) => (a, i)))
        {
            string where = $"assets[{i}]";
            Key(asset.Key, where);
            if (asset.ResourceName == null || !ResourcePattern.IsMatch(asset.ResourceName) || !asset.ResourceName.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
            { Error($"{where}.resourceName: required ASCII name ending in .png."); continue; }
            if (!resourceNames.Add(asset.ResourceName)) { Error($"{where}.resourceName: \"{asset.ResourceName}\" is used twice."); continue; }
            if (string.IsNullOrEmpty(asset.File) || Path.IsPathRooted(asset.File) || asset.File.Split('/', '\\').Contains(".."))
            { Error($"{where}.file: required path relative to the description, without '..'."); continue; }
            string file = Path.GetFullPath(Path.Combine(baseDir, asset.File));
            if (!File.Exists(file)) { Error($"{where}.file: resource \"{asset.File}\" not found."); continue; }
            byte[] bytes = File.ReadAllBytes(file);
            if (bytes.Length > MaxImageBytes || !TryPngSize(bytes, out int w, out int h) || w > MaxImageSide || h > MaxImageSide)
            { Error($"{where}.file: \"{asset.File}\" must be a PNG up to {MaxImageSide}px and {MaxImageBytes / 1024 / 1024} MiB."); continue; }
            if (asset.Key != null)
                images[asset.Key] = new(asset.Key, asset.ResourceName, file, w, h, Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)));
        }

        var objectIds = new HashSet<ulong>();
        var controlIds = new Dictionary<int, string>();
        var used = new HashSet<string>(StringComparer.Ordinal);
        var elements = new List<PlanElement>();
        var list = spec.Elements ?? [];
        if (list.Count is 0 or > MaxElements) Error($"elements: 1..{MaxElements} required.");
        foreach (var (e, i) in list.Select((e, i) => (e, i)))
        {
            string where = $"elements[{i}]";
            Key(e.Key, where);
            if (e.ObjectId is not (>= 1 and <= 1_000_000)) Error($"{where}.objectId: required, 1..1000000.");
            else if (!objectIds.Add((ulong)e.ObjectId)) Error($"{where}.objectId: {e.ObjectId} is used twice on the page.");
            if (e.ControlId is { } cid)
            {
                if (cid is < 1 or > 65535) Error($"{where}.controlId: 1..65535 or null.");
                else if (controlIds.TryGetValue(cid, out var other)) Error($"{where}.controlId: {cid} is already used by {other}; one ID would address two controls.");
                else controlIds[cid] = e.Key ?? where;
            }
            CheckText(e.Name, $"{where}.name", required: true, Error);
            if (e.Rect is not { Length: 4 } r || r[2] < 1 || r[3] < 1 || r[0] < 0 || r[1] < 0 || (long)r[0] + r[2] > canvasWidth || (long)r[1] + r[3] > canvasHeight)
                Error($"{where}.rect: [left, top, width, height] must lie inside the {canvasWidth}x{canvasHeight} canvas (Build moves outside controls to 0,0).");
            var font = e.Font == null ? null : new PlanFont(e.Font.Family, e.Font.Size, e.Font.Bold);
            if (e.Font is { Size: { } size } && size is < 4 or > 200) Error($"{where}.font.size: 4..200.");
            var basis = new PlanElement(e.Kind ?? "", e.Key ?? "", (ulong)(e.ObjectId ?? 0), e.ControlId ?? 0, e.Name ?? "", e.Rect ?? [], Font: font);
            switch (e.Kind)
            {
                case "label":
                    Forbid(e.States != null || e.Press != null || e.Display != null || e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "label", Error);
                    CheckText(e.Text, $"{where}.text", required: true, Error);
                    CheckColor(e.TextColor, $"{where}.textColor", required: false, Error);
                    elements.Add(basis with { Text = e.Text, TextColor = e.TextColor });
                    break;
                case "level":
                    Forbid(e.States != null || e.Press != null || e.Text != null || e.TextColor != null || e.Font != null, where, "level", Error);
                    if (e.Display == null || !Displays.TryGetValue(e.Display, out var display)) { Error($"{where}.display: slider or gauge."); display = ""; }
                    if (e.Orientation == null || !Orientations.TryGetValue(e.Orientation, out var orientation)) { Error($"{where}.orientation: {string.Join(", ", Orientations.Keys)}."); orientation = ""; }
                    if (e.Min is not >= 0 || e.Max is not > 0 || e.Min >= e.Max) Error($"{where}: min/max required, 0 <= min < max.");
                    CheckColor(e.FillColor, $"{where}.fillColor", required: false, Error);
                    elements.Add(basis with { Display = display, Orientation = orientation, Min = e.Min, Max = e.Max, FillColor = e.FillColor });
                    break;
                case "button":
                    Forbid(e.Text != null || e.TextColor != null || e.Display != null || e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "button (text lives on states)", Error);
                    elements.Add(basis with { States = Button(e, where, images, used, Error, out int press), PressState = press });
                    break;
                default:
                    Error($"{where}.kind: \"{e.Kind}\" is not supported; use button, label or level.");
                    break;
            }
        }
        foreach (var unused in images.Keys.Except(used)) Error($"assets: \"{unused}\" is not used by any state.");
        if (errors.Count > 0) throw new ScreenSpecException(errors);
        return new(projectName, planPage!, images.Values.Where(i => used.Contains(i.Key)).OrderBy(i => i.Key, StringComparer.Ordinal).ToArray(), elements);
    }

    private static IReadOnlyList<PlanState> Button(ElementSpec e, string where, Dictionary<string, PlanImage> images,
        HashSet<string> used, Action<string> error, out int press)
    {
        press = -1;
        var states = e.States ?? [];
        var result = new List<PlanState>();
        if (states.Count is < 2 or > MaxStates) { error($"{where}.states: 2..{MaxStates} required so that states can be told apart."); return result; }
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (s, i) in states.Select((s, i) => (s, i)))
        {
            string at = $"{where}.states[{i}]";
            CheckText(s.Name, $"{at}.name", required: true, error);
            if (s.Name != null && !names.Add(s.Name)) error($"{at}.name: \"{s.Name}\" is used twice.");
            if (s.Role is not ("normal" or "pressed" or "feedback")) error($"{at}.role: normal, pressed or feedback.");
            if ((i == 0) != (s.Role == "normal")) error($"{at}.role: state 0 and only state 0 is \"normal\" (the panel boots into state 0).");
            CheckText(s.Text, $"{at}.text", required: true, error);
            CheckColor(s.Fill, $"{at}.fill", required: true, error);
            CheckColor(s.TextColor, $"{at}.textColor", required: true, error);
            string? resource = null;
            if (s.Image != null)
            {
                if (images.TryGetValue(s.Image, out var image)) { resource = image.ResourceName; used.Add(s.Image); }
                else error($"{at}.image: asset \"{s.Image}\" is not declared or not readable.");
            }
            string imageAlign = Align(s.ImageAlign ?? "middle-center", $"{at}.imageAlign", error);
            string textAlign = Align(s.TextAlign ?? "middle-center", $"{at}.textAlign", error);
            result.Add(new(s.Name ?? "", s.Role ?? "", s.Text ?? "", s.Fill ?? "", s.TextColor ?? "", resource, imageAlign, textAlign));
        }
        if (states.Count(s => s.Role == "pressed") != 1) error($"{where}.states: exactly one \"pressed\" state (press feedback), kept apart from program feedback.");
        if (!states.Any(s => s.Role == "feedback")) error($"{where}.states: at least one \"feedback\" state, set by the control program.");
        int index = states.Select((s, i) => (s, i)).FirstOrDefault(x => x.s.Name == e.Press && e.Press != null, (null!, -1)).Item2;
        if (index < 0) error($"{where}.press: must name one of the states.");
        else if (states[index].Role != "pressed") error($"{where}.press: \"{e.Press}\" is not the pressed state.");
        press = index;
        // Identical looks would make feedback invisible on the panel.
        for (int a = 0; a < result.Count; a++)
            for (int b = a + 1; b < result.Count; b++)
                if (result[a] with { Name = "", Role = "" } == result[b] with { Name = "", Role = "" })
                    error($"{where}.states: \"{result[a].Name}\" and \"{result[b].Name}\" look identical.");
        return result;
    }

    private static string Align(string value, string where, Action<string> error)
    {
        if (Alignments.TryGetValue(value, out var mapped)) return mapped;
        error($"{where}: one of {string.Join(", ", Alignments.Keys)}.");
        return "";
    }

    private static void Forbid(bool present, string where, string kind, Action<string> error)
    {
        if (present) error($"{where}: contains properties that do not apply to {kind}.");
    }

    private static void CheckText(string? text, string where, bool required, Action<string> error)
    {
        if (text == null) { if (required) error($"{where}: required."); return; }
        bool encodable;
        try { Strict.GetByteCount(text); encodable = true; } catch (ArgumentException) { encodable = false; }
        if (!encodable || (required && text.Trim().Length == 0) || text.Length > MaxText || text.Contains('\0'))
            error($"{where}: 1..{MaxText} characters, no NUL or broken Unicode.");
    }

    private static void CheckColor(string? color, string where, bool required, Action<string> error)
    {
        if (color == null) { if (required) error($"{where}: required #RRGGBB or #AARRGGBB."); return; }
        if (!ColorPattern.IsMatch(color)) error($"{where}: \"{color}\" is not #RRGGBB or #AARRGGBB.");
    }

    public static bool TryPngSize(byte[] bytes, out int width, out int height)
    {
        width = height = 0;
        ReadOnlySpan<byte> signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        if (bytes.Length < 33 || !bytes.AsSpan(0, 8).SequenceEqual(signature) || !bytes.AsSpan(12, 4).SequenceEqual("IHDR"u8)) return false;
        width = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16)); height = BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20));
        return width > 0 && height > 0;
    }
}
