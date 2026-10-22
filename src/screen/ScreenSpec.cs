using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ExtronExporter.Screen;

// Experimental screen description (schema "exui-screen-experiment/0"). Deliberately NOT the .exui
// contract: it exists to prove that pages can be generated from our own data with fixed IDs.
// Two forms: one `page` with `elements` (stage 4), or `pages` + `popups` + `groups` (multi-container).

public sealed record ScreenSpec(
    string? Schema, string? Panel, ProjectSpec? Project, PageSpec? Page,
    IReadOnlyList<AssetSpec>? Assets, IReadOnlyList<ElementSpec>? Elements,
    IReadOnlyList<PageSpec>? Pages = null, IReadOnlyList<PopupSpec>? Popups = null, IReadOnlyList<GroupSpec>? Groups = null);

public sealed record ProjectSpec(string? Name);

/// <summary>
/// ObjectId is the page's editor ID (idField); GUI Designer also uses it as the page number.
/// ShownBy (pages form): start (exactly one page), navigation (a button names it) or program.
/// </summary>
public sealed record PageSpec(string? Key, int? ObjectId, string? Name, string? Background,
    string? ShownBy = null, IReadOnlyList<ElementSpec>? Elements = null);

/// <summary>
/// Modal popups are full-canvas and ungrouped; Build adds their references to every page. Standard popups
/// have their own size and are placed by a popup-ref element, directly or through their group.
/// </summary>
public sealed record PopupSpec(string? Key, int? ObjectId, string? Name, string? Background, bool? Modal,
    int[]? Size, string? Group, string? ShownBy, IReadOnlyList<ElementSpec>? Elements);

/// <summary>GroupId is the popup group's UInt16 ID in the project registry; Name is shown in GUI Designer.</summary>
public sealed record GroupSpec(string? Key, int? GroupId, string? Name);

public sealed record AssetSpec(string? Key, string? File, string? ResourceName);

public sealed record FontSpec(string? Family, double? Size, bool? Bold, string? Style = null);

/// <summary>
/// ObjectId: editor object ID (PBControlBase.idField), unique within the page.
/// ControlId: Extron ID addressed by the control program (userIdField, UInt16); null means 0 / not addressed.
/// </summary>
public sealed record ElementSpec(
    string? Key, string? Kind, long? ObjectId, int? ControlId, string? Name, int[]? Rect,
    string? Text, string? TextColor, FontSpec? Font,
    IReadOnlyList<StateSpec>? States, string? Press,
    string? Display, string? Orientation, int? Min, int? Max, string? FillColor,
    string? Navigate = null, string? Popup = null, string? Group = null, string? Image = null,
    NativeStyle? Native = null, BehaviorSpec? Behavior = null, string? TextAlign = null);

public sealed record NativeStyle(string? TrackColor = null, int? TrackWidth = null, string? ThumbColor = null,
    int? ThumbWidth = null, int? ThumbHeight = null, string? ThumbType = null, int? Radius = null,
    string? Shape = null, string? StrokeColor = null, int? Thickness = null, string? Pattern = null);
// Instructions for the control program, deliberately not claimed as native button actions.
public sealed record BehaviorSpec(string? SelectionGroup = null, bool? Enabled = null, bool? Visible = null);

/// <summary>Role: normal (state 0, at rest), pressed (shown while held), feedback (set by the control program).</summary>
public sealed record StateSpec(string? Name, string? Role, string? Text, string? Fill, string? TextColor,
    string? Image, string? ImageAlign, string? TextAlign);

public sealed class ScreenSpecException(IReadOnlyList<string> errors)
    : Exception("Screen description is invalid:\n  " + string.Join("\n  ", errors))
{
    public IReadOnlyList<string> Errors { get; } = errors;
}

// ---- normalized form handed to the adapter (field names match ExtronAdapterHost.ps1) -------------------

public sealed record GeneratePlan(string ProjectName, string StartPage, IReadOnlyList<PlanContainer> Pages,
    IReadOnlyList<PlanContainer> Popups, IReadOnlyList<PlanGroup> Groups, IReadOnlyList<PlanImage> Images)
{
    [JsonIgnore] public PlanContainer Page => Pages.Single(p => p.Key == StartPage);
    [JsonIgnore] public IReadOnlyList<PlanElement> Elements => Page.Elements;
    [JsonIgnore] public IEnumerable<PlanContainer> Containers => Pages.Concat(Popups);
}
/// <summary>A page or popup. Width/Height: the canvas for pages and modal popups, the authored size otherwise.</summary>
public sealed record PlanContainer(string Key, int ObjectId, string Name, string? Background, int Width, int Height,
    IReadOnlyList<PlanElement> Elements, bool Modal = false, string? Group = null, string ShownBy = "start");
/// <summary>ReferenceCount: popup-ref elements bound to the group (written to PBControlGroup.referenceCountField).</summary>
public sealed record PlanGroup(string Key, int GroupId, string Name, int ReferenceCount);
public sealed record PlanImage(string Key, string ResourceName, string File, int Width, int Height, string Sha256);
public sealed record PlanFont(string? Family, double? Size, bool? Bold, bool Italic = false, string? Resource = null);
public sealed record PlanState(string Name, string Role, string Text, string Fill, string TextColor, string? Image, string ImageAlign, string TextAlign);
public sealed record PlanElement(
    string Kind, string Key, ulong ObjectId, int ControlId, string Name, int[] Rect,
    string? Text = null, string? TextColor = null, PlanFont? Font = null,
    IReadOnlyList<PlanState>? States = null, int? PressState = null,
    string? Display = null, string? Orientation = null, int? Min = null, int? Max = null, string? FillColor = null,
    string? Navigate = null, string? Popup = null, string? Group = null, string? Image = null,
    NativeStyle? Native = null, BehaviorSpec? Behavior = null, string TextAlign = "MiddleLeft");

public static class ScreenSpecReader
{
    public const string Schema = "exui-screen-experiment/0";
    public const int MaxElements = 64, MaxStates = 8, MaxText = 256, MaxImageBytes = 4 * 1024 * 1024, MaxImageSide = 4096;
    public const int MaxPages = 16, MaxPopups = 32, MaxGroups = 16, MaxTotalElements = 256;
    public const string OfflinePageName = "Offline Page";

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

        var ctx = new ElementContext(images, Error, Key);
        var pages = new List<PlanContainer>();
        var popups = new List<PlanContainer>();
        var groups = new List<PlanGroup>();
        string startPage = "";
        if (spec.Pages == null && spec.Popups == null && spec.Groups == null)
        {
            var page = spec.Page;
            if (page == null) Error("page: required.");
            else
            {
                Key(page.Key, "page");
                if (page.ObjectId is not (>= 1 and <= 65534)) Error("page.objectId: required, 1..65534 (stored as a UInt16 start page; 65535 is the Offline page).");
                CheckText(page.Name, "page.name", required: true, Error);
                CheckColor(page.Background, "page.background", required: false, Error);
                if (page.ShownBy != null || page.Elements != null) Error("page: shownBy and elements belong to the pages form.");
                var list = spec.Elements ?? [];
                if (list.Count is 0 or > MaxElements) Error($"elements: 1..{MaxElements} required.");
                var elements = Elements(list, "elements", canvasWidth, canvasHeight, allowPopupRef: false, ctx);
                startPage = page.Key ?? "";
                pages.Add(new(startPage, page.ObjectId ?? 0, page.Name ?? "", page.Background, canvasWidth, canvasHeight, elements));
            }
        }
        else
        {
            if (spec.Page != null || spec.Elements != null) Error("page/elements: use either one page or the pages form, not both.");
            var containerIds = new Dictionary<int, string>();
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { OfflinePageName };
            void Container(string? key, int? id, string? name, string? background, string where)
            {
                Key(key, where);
                if (id is not (>= 1 and <= 65534)) Error($"{where}.objectId: required, 1..65534 (65535 is the Offline page).");
                else if (!containerIds.TryAdd(id.Value, key ?? where)) Error($"{where}.objectId: {id} is already used by {containerIds[id.Value]}; pages and popups share one ID space.");
                CheckText(name, $"{where}.name", required: true, Error);
                if (name != null && !names.Add(name)) Error($"{where}.name: \"{name}\" is used twice; page and popup names share one namespace with the Offline Page (Build rejects duplicates).");
                CheckColor(background, $"{where}.background", required: false, Error);
            }
            var groupKeys = new HashSet<string>(StringComparer.Ordinal);
            var groupIds = new HashSet<int>();
            var groupNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (g, i) in (spec.Groups ?? []).Select((g, i) => (g, i)))
            {
                string where = $"groups[{i}]";
                Key(g.Key, where);
                if (g.GroupId is not (>= 1 and <= 65535)) Error($"{where}.groupId: required, 1..65535 (0 means ungrouped).");
                else if (!groupIds.Add(g.GroupId.Value)) Error($"{where}.groupId: {g.GroupId} is used twice.");
                CheckText(g.Name, $"{where}.name", required: true, Error);
                if (g.Name != null && !groupNames.Add(g.Name)) Error($"{where}.name: \"{g.Name}\" is used twice.");
                if (g.Key != null) groupKeys.Add(g.Key);
            }
            if ((spec.Pages ?? []).Count is 0 or > MaxPages) Error($"pages: 1..{MaxPages} required.");
            if ((spec.Popups ?? []).Count > MaxPopups) Error($"popups: at most {MaxPopups}.");
            if ((spec.Groups ?? []).Count > MaxGroups) Error($"groups: at most {MaxGroups}.");
            foreach (var (p, i) in (spec.Pages ?? []).Select((p, i) => (p, i)))
            {
                string where = $"pages[{i}]";
                Container(p.Key, p.ObjectId, p.Name, p.Background, where);
                if (p.ShownBy is not ("start" or "navigation" or "program")) Error($"{where}.shownBy: start, navigation or program.");
                if (p.ShownBy == "start")
                {
                    if (startPage != "") Error($"{where}.shownBy: only one page can be the start page.");
                    startPage = p.Key ?? "";
                }
                var list = p.Elements ?? [];
                if (list.Count is 0 or > MaxElements) Error($"{where}.elements: 1..{MaxElements} required.");
                pages.Add(new(p.Key ?? "", p.ObjectId ?? 0, p.Name ?? "", p.Background, canvasWidth, canvasHeight,
                    Elements(list, $"{where}.elements", canvasWidth, canvasHeight, allowPopupRef: true, ctx), ShownBy: p.ShownBy ?? ""));
            }
            if (startPage == "") Error("pages: exactly one page needs shownBy \"start\".");
            foreach (var (p, i) in (spec.Popups ?? []).Select((p, i) => (p, i)))
            {
                string where = $"popups[{i}]";
                Container(p.Key, p.ObjectId, p.Name, p.Background, where);
                bool modal = p.Modal ?? false;
                if (p.Modal == null) Error($"{where}.modal: required true or false.");
                int w = canvasWidth, h = canvasHeight;
                if (modal)
                {
                    // Every modal popup in the studied projects is full-canvas and ungrouped.
                    if (p.Size != null || p.Group != null) Error($"{where}: a modal popup is full-canvas and ungrouped; omit size and group.");
                }
                else if (p.Size is not { Length: 2 } size || size[0] < 1 || size[1] < 1 || size[0] > canvasWidth || size[1] > canvasHeight)
                    Error($"{where}.size: [width, height] within the {canvasWidth}x{canvasHeight} canvas.");
                else { w = size[0]; h = size[1]; }
                if (p.Group != null && !groupKeys.Contains(p.Group)) Error($"{where}.group: \"{p.Group}\" is not a declared group.");
                if (p.ShownBy is not ("navigation" or "program")) Error($"{where}.shownBy: navigation or program.");
                var list = p.Elements ?? [];
                if (list.Count is 0 or > MaxElements) Error($"{where}.elements: 1..{MaxElements} required.");
                popups.Add(new(p.Key ?? "", p.ObjectId ?? 0, p.Name ?? "", p.Background, w, h,
                    Elements(list, $"{where}.elements", w, h, allowPopupRef: false, ctx), modal, p.Group, p.ShownBy ?? ""));
            }
            if (pages.Concat(popups).Sum(c => c.Elements.Count) > MaxTotalElements) Error($"At most {MaxTotalElements} elements in total.");

            // Placement of standard popups (four binding sites are written from this), navigation, reachability.
            var popupByKey = new Dictionary<string, PlanContainer>(StringComparer.Ordinal);
            foreach (var p in popups) popupByKey.TryAdd(p.Key, p);
            var refs = pages.SelectMany(pg => pg.Elements.Where(e => e.Kind == "popup-ref").Select(e => (Page: pg, Ref: e))).ToArray();
            foreach (var (pg, r) in refs)
            {
                string where = $"{pg.Key}/{r.Key}";
                if ((r.Popup == null) == (r.Group == null)) { Error($"{where}: a popup-ref names exactly one popup or one group."); continue; }
                PlanContainer[] targets;
                if (r.Popup != null)
                {
                    if (!popupByKey.TryGetValue(r.Popup, out var target)) { Error($"{where}.popup: \"{r.Popup}\" is not a declared popup."); continue; }
                    if (target.Modal) { Error($"{where}.popup: \"{r.Popup}\" is modal; Build creates references to modal popups itself."); continue; }
                    if (target.Group != null) { Error($"{where}.popup: \"{r.Popup}\" belongs to group \"{target.Group}\"; reference the group."); continue; }
                    targets = [target];
                }
                else
                {
                    if (!groupKeys.Contains(r.Group!)) { Error($"{where}.group: \"{r.Group}\" is not a declared group."); continue; }
                    targets = popups.Where(p => p.Group == r.Group).ToArray();
                }
                foreach (var t in targets)
                    if (r.Rect.Length == 4 && (t.Width != r.Rect[2] || t.Height != r.Rect[3]))
                        Error($"{where}.rect: {r.Rect[2]}x{r.Rect[3]} must equal the size of popup \"{t.Key}\" ({t.Width}x{t.Height}); a popup is shown at its authored size.");
            }
            foreach (var p in popups.Where(p => !p.Modal))
                if (!refs.Any(x => x.Ref.Popup == p.Key || (p.Group != null && x.Ref.Group == p.Group)))
                    Error($"{p.Key}: a standard popup needs a popup-ref on a page, directly or through its group.");
            foreach (var g in groupKeys)
            {
                var members = popups.Where(p => p.Group == g).ToArray();
                if (members.Length == 0) Error($"{g}: a group needs at least one member popup.");
                if (members.Select(p => (p.Width, p.Height)).Distinct().Count() > 1) Error($"{g}: member popups of one group must share one size.");
            }
            var navigable = pages.Concat(popups).Select(c => c.Key).ToHashSet(StringComparer.Ordinal);
            var navigation = pages.Concat(popups).SelectMany(c => c.Elements.Where(e => e.Navigate != null).Select(e => (Container: c, Button: e))).ToArray();
            foreach (var (c, b) in navigation)
            {
                if (!navigable.Contains(b.Navigate!)) Error($"{c.Key}/{b.Key}.navigate: \"{b.Navigate}\" is not a page or popup.");
                else if (b.Navigate == c.Key) Error($"{c.Key}/{b.Key}.navigate: a button cannot lead to its own page or popup.");
            }
            foreach (var c in pages.Concat(popups).Where(c => c.ShownBy == "navigation"))
                if (!navigation.Any(x => x.Button.Navigate == c.Key)) Error($"{c.Key}: shownBy \"navigation\" but no button navigates to it; add one or use \"program\".");
            groups = (spec.Groups ?? []).Where(g => g.Key != null)
                .Select(g => new PlanGroup(g.Key!, g.GroupId ?? 0, g.Name ?? "", refs.Count(x => x.Ref.Group == g.Key))).ToList();
        }
        foreach (var unused in images.Keys.Except(ctx.Used)) Error($"assets: \"{unused}\" is not used by any state.");
        if (errors.Count > 0) throw new ScreenSpecException(errors);
        return new(projectName, startPage, pages, popups, groups,
            images.Values.Where(i => ctx.Used.Contains(i.Key)).OrderBy(i => i.Key, StringComparer.Ordinal).ToArray());
    }

    private sealed class ElementContext(Dictionary<string, PlanImage> images, Action<string> error, Action<string?, string> key)
    {
        public Dictionary<string, PlanImage> Images { get; } = images;
        public Action<string> Error { get; } = error;
        public Action<string?, string> Key { get; } = key;
        public HashSet<string> Used { get; } = new(StringComparer.Ordinal);
        // One control ID addresses one control in the whole project.
        public Dictionary<int, string> ControlIds { get; } = new();
    }

    private static List<PlanElement> Elements(IReadOnlyList<ElementSpec> list, string prefix, int width, int height, bool allowPopupRef, ElementContext ctx)
    {
        var Error = ctx.Error;
        var objectIds = new HashSet<ulong>();
        var elements = new List<PlanElement>();
        foreach (var (e, i) in list.Select((e, i) => (e, i)))
        {
            string where = $"{prefix}[{i}]";
            ctx.Key(e.Key, where);
            if (e.ObjectId is not (>= 1 and <= 1_000_000)) Error($"{where}.objectId: required, 1..1000000.");
            else if (!objectIds.Add((ulong)e.ObjectId)) Error($"{where}.objectId: {e.ObjectId} is used twice on the page.");
            if (e.ControlId is { } cid)
            {
                if (cid is < 1 or > 65535) Error($"{where}.controlId: 1..65535 or null.");
                else if (ctx.ControlIds.TryGetValue(cid, out var other)) Error($"{where}.controlId: {cid} is already used by {other}; one ID would address two controls.");
                else ctx.ControlIds[cid] = e.Key ?? where;
            }
            CheckText(e.Name, $"{where}.name", required: true, Error);
            if (e.Rect is not { Length: 4 } r || r[2] < 1 || r[3] < 1 || r[0] < 0 || r[1] < 0 || (long)r[0] + r[2] > width || (long)r[1] + r[3] > height)
                Error($"{where}.rect: [left, top, width, height] must lie inside the {width}x{height} canvas (Build moves outside controls to 0,0).");
            PlanFont? font = null;
            if(e.Font != null){try{font=NativeFonts.Resolve(e.Font);}catch(ArgumentException ex){Error($"{where}.font: {ex.Message}");}}
            string alignment="MiddleLeft";
            if(e.TextAlign != null && (e.Kind is not ("label" or "value" or "datetime") || !Alignments.TryGetValue(e.TextAlign,out alignment!)))Error($"{where}.textAlign: supported only for label, value and datetime; use top/middle/bottom-left/center/right.");
            if (e.Font is { Size: { } size } && size is < 4 or > 200) Error($"{where}.font.size: 4..200.");
            if (e.Kind != "button" && e.Navigate != null) Error($"{where}.navigate: only a button can lead to a page or popup.");
            if (e.Kind != "popup-ref" && (e.Popup != null || e.Group != null)) Error($"{where}: popup and group apply to popup-ref only.");
            if (e.Kind != "graphic" && e.Image != null) Error($"{where}.image: standalone image applies to graphic only.");
            if (e.Behavior != null)
            {
                if (e.ControlId == null) Error($"{where}.behavior: requires an addressable control.");
                if (e.Behavior.SelectionGroup != null && (e.Kind != "button" || !KeyPattern.IsMatch(e.Behavior.SelectionGroup))) Error($"{where}.behavior.selectionGroup: lowercase group key on buttons only.");
            }
            var basis = new PlanElement(e.Kind ?? "", e.Key ?? "", (ulong)(e.ObjectId ?? 0), e.ControlId ?? 0, e.Name ?? "", e.Rect ?? [], Font: font, Native: e.Native, Behavior: e.Behavior, TextAlign: alignment);
            if (e.Kind is "slider" or "shape" or "line" or "datetime")
            {
                elements.Add(Extended(e, basis, where, Error));
                continue;
            }
            switch (e.Kind)
            {
                case "graphic":
                    Forbid(e.States != null || e.Press != null || e.Text != null || e.TextColor != null || e.Font != null || e.Display != null || e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "graphic", Error);
                    if(e.ControlId != null) Error($"{where}.controlId: a graphic is passive; use null.");
                    if(e.Image == null || !ctx.Images.TryGetValue(e.Image,out var graphic)) Error($"{where}.image: declare a readable PNG asset.");
                    else
                    {
                        ctx.Used.Add(e.Image);
                        if(e.Rect is { Length:4 } && (e.Rect[2] != graphic.Width || e.Rect[3] != graphic.Height)) Error($"{where}.image: Native PNG dimensions must equal the graphic rectangle.");
                        elements.Add(basis with { Image = graphic.ResourceName });
                    }
                    break;
                case "value":
                    if (e.ControlId == null) Error($"{where}.controlId: a dynamic value requires an ID.");
                    goto case "label";
                case "label":
                    Forbid(e.States != null || e.Press != null || e.Display != null || e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "label", Error);
                    CheckText(e.Text, $"{where}.text", required: true, Error);
                    CheckColor(e.TextColor, $"{where}.textColor", required: false, Error);
                    elements.Add(basis with { Text = e.Text, TextColor = e.TextColor });
                    break;
                case "level":
                    bool multi = e.Display == "multistate";
                    if(multi && (e.Font == null || e.States == null)) Error($"{where}: multistate requires font and states.");
                    Forbid((!multi && (e.States != null || e.Font != null)) || e.Press != null || e.Text != null || e.TextColor != null, where, "level", Error);
                    string display;
                    if (e.Display is "multistate" or "volume-led") display = e.Display == "multistate" ? "MultistateLevel" : "VolumeLED";
                    else if (e.Display == null || !Displays.TryGetValue(e.Display, out display!)) { Error($"{where}.display: slider or gauge."); display = ""; }
                    if (e.Orientation == null || !Orientations.TryGetValue(e.Orientation, out var orientation)) { Error($"{where}.orientation: {string.Join(", ", Orientations.Keys)}."); orientation = ""; }
                    if (e.Min is not >= 0 || e.Max is not > 0 || e.Min >= e.Max) Error($"{where}: min/max required, 0 <= min < max.");
                    CheckColor(e.FillColor, $"{where}.fillColor", required: false, Error);
                    var levelStates = multi ? Button(e, where, ctx.Images, ctx.Used, Error, out _) : null;
                    elements.Add(basis with { Display = display, Orientation = orientation, Min = e.Min, Max = e.Max, FillColor = e.FillColor, States = levelStates });
                    break;
                case "button":
                    Forbid(e.Text != null || e.TextColor != null || e.Display != null || e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "button (text lives on states)", Error);
                    elements.Add(basis with { States = Button(e, where, ctx.Images, ctx.Used, Error, out int press), PressState = press, Navigate = e.Navigate });
                    break;
                case "popup-ref" when allowPopupRef:
                    Forbid(e.States != null || e.Press != null || e.Text != null || e.TextColor != null || e.Font != null || e.Display != null ||
                        e.Orientation != null || e.Min != null || e.Max != null || e.FillColor != null, where, "popup-ref", Error);
                    if (e.ControlId != null) Error($"{where}.controlId: a popup-ref has no control ID; use null.");
                    elements.Add(basis with { Popup = e.Popup, Group = e.Group });
                    break;
                case "popup-ref":
                    Error($"{where}.kind: popup-ref is supported on pages only.");
                    break;
                default:
                    Error($"{where}.kind: \"{e.Kind}\" is not supported; use button, label, level{(allowPopupRef ? " or popup-ref" : "")}.");
                    break;
            }
        }
        return elements;
    }

    private static PlanElement Extended(ElementSpec e, PlanElement basis, string where, Action<string> error)
    {
        var n = e.Native;
        if (n == null) { error($"{where}.native: required."); return basis; }
        Forbid(e.States != null || e.Press != null || e.Image != null || e.Display != null || e.Navigate != null || e.Popup != null || e.Group != null, where, e.Kind!, error);
        if (e.Kind == "slider")
        {
            if (e.ControlId == null) error($"{where}.controlId: slider requires an ID.");
            if (e.Min is not >= 0 || e.Max is not > 0 || e.Min >= e.Max) error($"{where}: 0 <= min < max required.");
            if (e.Orientation == null || !Orientations.ContainsKey(e.Orientation)) error($"{where}.orientation: unsupported.");
            CheckColor(e.FillColor, where + ".fillColor", true, error);
            CheckColor(n.TrackColor, where + ".native.trackColor", true, error);
            CheckColor(n.ThumbColor, where + ".native.thumbColor", true, error);
            if (e.Rect is { Length: 4 } r && (n.TrackWidth is not > 0 || n.ThumbWidth is not > 0 || n.ThumbHeight is not > 0 ||
                n.ThumbWidth > r[2] || n.ThumbHeight > r[3] || n.TrackWidth > Math.Min(r[2], r[3]))) error($"{where}.native: track/thumb must fit the control.");
            if (n.Radius is not >= 0 || n.Radius > n.TrackWidth / 2) error($"{where}.native.radius: must fit half the track width.");
            if (n.ThumbType is not ("ellipse" or "rectangle" or "none")) error($"{where}.native.thumbType: ellipse, rectangle or none.");
            Forbid(e.Font != null || e.Text != null || e.TextColor != null, where, "slider", error);
            return basis with { Min = e.Min, Max = e.Max, Orientation = e.Orientation != null && Orientations.TryGetValue(e.Orientation, out var o) ? o : "", FillColor = e.FillColor };
        }
        if (e.ControlId != null) error($"{where}.controlId: {e.Kind} is passive; use null.");
        Forbid(e.Orientation != null || e.Min != null || e.Max != null, where, e.Kind!, error);
        if (e.Kind == "datetime")
        {
            CheckText(n.Pattern, where + ".native.pattern", true, error);
            // Explicit custom formats only: no locale-dependent one-letter format expansion.
            if (n.Pattern is { } pattern)
            {
                if (pattern.Length < 2 || pattern.Length > 100) error($"{where}.native.pattern: 2..100 characters.");
                try { _ = DateTime.UnixEpoch.ToString(pattern, System.Globalization.CultureInfo.InvariantCulture); }
                catch (FormatException) { error($"{where}.native.pattern: invalid time format."); }
            }
            CheckColor(e.TextColor, where + ".textColor", true, error);
            Forbid(e.Text != null || e.FillColor != null, where, "datetime", error);
            return basis with { TextColor = e.TextColor };
        }
        Forbid(e.Text != null || e.TextColor != null || e.Font != null, where, e.Kind!, error);
        CheckColor(e.FillColor, where + ".fillColor", true, error);
        if (e.Kind == "shape")
        {
            if (n.Shape is not ("rectangle" or "ellipse")) error($"{where}.native.shape: rectangle or ellipse.");
            if(n.Shape == "ellipse" && n.Radius != 0) error($"{where}.native.radius: ellipse requires 0.");
            CheckColor(n.StrokeColor, where + ".native.strokeColor", true, error);
            if (n.Radius is not >= 0 || n.Thickness is not >= 0 || e.Rect is { Length: 4 } sr && (n.Radius > Math.Min(sr[2], sr[3]) / 2 || n.Thickness > Math.Min(sr[2], sr[3]) / 2)) error($"{where}.native: radius/thickness must fit the shape.");
        }
        else if (n.Thickness is not > 0 || e.Rect is { Length: 4 } lr && n.Thickness > Math.Min(lr[2], lr[3])) error($"{where}.native.thickness: positive and within line bounds.");
        return basis with { FillColor = e.FillColor };
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
            // exui/5 Button text may be empty when independent labels overlay
            // the touch target. Other controls require nonempty text.
            if (!(e.Kind == "button" && s.Text == ""))
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
        bool momentary = states.Count == 2 && states.Select(s => s.Role).SequenceEqual(new[] { "normal", "pressed" });
        bool hasPressed = states.Any(s => s.Role == "pressed");
        if (states.Count(s => s.Role == "pressed") > 1) error($"{where}.states: at most one pressed state.");
        if (!momentary && !states.Any(s => s.Role == "feedback")) error($"{where}.states: at least one \"feedback\" state, set by the control program.");
        int index = states.Select((s, i) => (s, i)).FirstOrDefault(x => x.s.Name == e.Press && e.Press != null, (null!, -1)).Item2;
        if (!hasPressed) { if (e.Press != null) error($"{where}.press: no pressed state."); }
        else if (index < 0) error($"{where}.press: must name one of the states.");
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
