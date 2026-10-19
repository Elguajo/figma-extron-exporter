using ExtronExporter.Format;

namespace ExtronExporter.Screen;

public sealed record CheckResult(string Id, bool Passed, string Detail);

/// <summary>Expected panel profile of a donor (from samples/donors.json).</summary>
public sealed record ExpectedProfile(string Panel, string PlatformClass, string PlatformType, int PlatformTypeValue, string PartNumber, int Width, int Height);

/// <summary>
/// Independent check of a generated payload: decoded with the Microsoft NRBF reader, never with the
/// Extron assemblies that wrote it. Elements are matched by objectId, not by position.
/// </summary>
public static class ScreenVerifier
{
    // Declaration order of the Extron enums as reported by the adapter host on 1.28.0.7; the host's
    // own report is compared against these before a result is accepted.
    public static readonly IReadOnlyDictionary<string, int> LevelDisplay = new Dictionary<string, int> { ["Gauge"] = 0, ["Slider"] = 1 };
    public static readonly IReadOnlyDictionary<string, int> LevelOrientation = new Dictionary<string, int>
    { ["LeftToRight"] = 0, ["RightToLeft"] = 1, ["BottomToTop"] = 2, ["TopToBottom"] = 3 };

    private static readonly Dictionary<string, string> Types = new() { ["button"] = "PBButton", ["label"] = "PBLabel", ["level"] = "PBLevel", ["popup-ref"] = "PBPopupPageReference" };

    public static IReadOnlyList<CheckResult> ProfileChecks(ProjectModel model, ExpectedProfile expected)
    {
        var p = model.Platform;
        return
        [
            new("profile.platform-class", p.PlatformClass == expected.PlatformClass, $"{p.PlatformClass} (expected {expected.PlatformClass})"),
            new("profile.platform-type", p.PlatformTypeValue == expected.PlatformTypeValue, $"PlatformProTypeEnum value {p.PlatformTypeValue} (expected {expected.PlatformTypeValue} = {expected.PlatformType})"),
            new("profile.part-number", p.PartNumber == expected.PartNumber, $"{p.PartNumber} (expected {expected.PartNumber})"),
            new("profile.screen", p.ScreenWidth == expected.Width && p.ScreenHeight == expected.Height && p.PlatformWidth == expected.Width && p.PlatformHeight == expected.Height,
                $"screen {p.ScreenWidth}x{p.ScreenHeight}, platform {p.PlatformWidth}x{p.PlatformHeight} (expected {expected.Width}x{expected.Height})"),
            new("profile.app-version", model.AppVersion == "1.28.0.7", model.AppVersion),
            new("profile.checksum", model.Checksum == 0, $"checksum {model.Checksum?.ToString() ?? "absent"}")
        ];
    }

    /// <param name="afterGuiBuild">
    /// The file was saved by GUI Designer with Save and Build: Build adds one full-canvas reference per modal
    /// popup to every page (with back-references), may assign a new project ID, and "Remove unused" may drop
    /// donor resources. Those Build-owned differences are tolerated; everything the plan wrote is still checked.
    /// </param>
    public static IReadOnlyList<CheckResult> Verify(GeneratePlan plan, ProjectModel model, ProjectModel donor, ExpectedProfile expected, bool afterGuiBuild = false)
    {
        var checks = new List<CheckResult>(ProfileChecks(model, expected));
        void Check(string id, bool ok, string detail) => checks.Add(new(id, ok, detail));
        const ulong None = ulong.MaxValue;
        const int ControlObject = 3; // ObjectTypeEnum.Control, read from the reference project

        Check("project.name", model.Name == plan.ProjectName, model.Name);
        Check("page.count", model.Pages.Count == plan.Pages.Count, $"{model.Pages.Count} page(s), expected {plan.Pages.Count}");
        Check("page.default", model.DefaultPage == plan.Page.ObjectId, $"defaultPage {model.DefaultPage}");
        Check("page.order", model.Pages.Select(p => p.ObjectId).SequenceEqual(plan.Pages.Select(p => (ulong)p.ObjectId)), "pages in plan order");
        var offline = donor.Popups.Where(p => p.ObjectId == 65535).ToArray();
        var expectedPopups = offline.Select(p => p.ObjectId).Concat(plan.Popups.Select(p => (ulong)p.ObjectId)).ToHashSet();
        Check("popup.set", model.Popups.Select(p => p.ObjectId).ToHashSet().SetEquals(expectedPopups) && model.Popups.Count == expectedPopups.Count,
            string.Join(", ", model.Popups.Select(p => $"{p.ObjectId}:{p.Name}")));
        foreach (var o in offline)
        {
            var kept = model.Popups.SingleOrDefault(p => p.ObjectId == 65535);
            Check("popup.offline", kept != null && kept.Name == o.Name && kept.Width == o.Width && kept.Height == o.Height && kept.Controls.Count == o.Controls.Count,
                kept == null ? "missing" : $"{kept.Name} {kept.Width}x{kept.Height}, {kept.Controls.Count} control(s)");
        }
        var modalIds = plan.Popups.Where(p => p.Modal).Select(p => (ulong)p.ObjectId).Concat(offline.Select(p => p.ObjectId)).ToHashSet();
        bool BuildOwned(ControlModel c) => afterGuiBuild && c.PopupBinding is { Modal: true } b && modalIds.Contains(b.PopupId);

        var names = model.Resources.Where(r => r.Type == "PBImageResource").Select(r => r.Name).ToHashSet(StringComparer.Ordinal);
        var models = model.Pages.Concat(model.Popups).ToArray();
        foreach (var container in plan.Containers)
        {
            bool isPage = plan.Pages.Contains(container);
            string at = $"{(isPage ? "page" : "popup")}.{container.Key}";
            var found = (isPage ? model.Pages : model.Popups).Where(p => p.ObjectId == (ulong)container.ObjectId).ToArray();
            if (found.Length != 1) { Check($"{at}.present", false, $"objectId {container.ObjectId} found {found.Length} time(s)"); continue; }
            var m = found[0];
            Check($"{at}.ids", m.ControlId == container.ObjectId, $"id {m.ObjectId}, userId {m.ControlId}");
            Check($"{at}.name", m.Name == container.Name, m.Name);
            Check($"{at}.key", m.Comments == "exui-key=" + container.Key, m.Comments ?? "null");
            Check($"{at}.size", m.Width == container.Width && m.Height == container.Height, $"{m.Width}x{m.Height}");
            if (container.Background != null) Check($"{at}.background", m.Background == Argb(container.Background), Hex(m.Background));
            var authored = m.Controls.Where(c => !BuildOwned(c)).ToArray();
            Check($"{at}.controls", authored.Length == container.Elements.Count, $"{authored.Length} control(s), expected {container.Elements.Count}" +
                (authored.Length != m.Controls.Count ? $"; {m.Controls.Count - authored.Length} modal reference(s) added by Build" : ""));
            Check($"{at}.object-ids-unique", m.Controls.Select(c => c.ObjectId).Distinct().Count() == m.Controls.Count, "idField unique within the page or popup");
            if (!isPage)
            {
                var info = m.Popup;
                string? groupName = container.Group == null ? null : plan.Groups.Single(g => g.Key == container.Group).Name;
                ushort groupId = container.Group == null ? (ushort)0 : (ushort)plan.Groups.Single(g => g.Key == container.Group).GroupId;
                Check($"{at}.kind", info != null && info.Modal == container.Modal, info == null ? "not a popup" : $"modal {info.Modal}");
                Check($"{at}.group", info != null && info.GroupId == groupId && info.GroupName == groupName, info == null ? "-" : $"group {info.GroupId} '{info.GroupName}'");
                if (!container.Modal || !afterGuiBuild)
                {
                    // Back-references: exactly one per popup-ref that places this popup, directly or through its group.
                    var expectedRefs = plan.Pages.SelectMany(p => p.Elements.Where(e => e.Kind == "popup-ref" &&
                            (e.Popup == container.Key || (container.Group != null && e.Group == container.Group)))
                        .Select(e => ((ulong)p.ObjectId, None, e.ObjectId))).OrderBy(x => x).ToArray();
                    var actualRefs = (info?.References ?? []).Select(r => (r.PageId, r.PopupPageId, r.ObjectId)).OrderBy(x => x).ToArray();
                    bool typesOk = (info?.References ?? []).All(r => r.ObjectType == ControlObject && (afterGuiBuild || r.ProjectId == model.ProjectId));
                    Check($"{at}.back-references", actualRefs.SequenceEqual(expectedRefs) && typesOk && info?.HasReferences == (expectedRefs.Length > 0),
                        $"{actualRefs.Length} back-reference(s), expected {expectedRefs.Length}; hasReferences {info?.HasReferences}");
                }
            }
            foreach (var e in container.Elements) CheckElement(e, m, $"element.{e.Key}");
        }

        // Group registry: one entry per plan group, in plan order.
        var groups = model.Groups ?? [];
        Check("groups.registry", groups.Select(g => (g.Id, g.Name, g.Index)).SequenceEqual(plan.Groups.Select((g, i) => ((ushort)g.GroupId, g.Name, i))),
            string.Join(", ", groups.Select(g => $"{g.Id}:{g.Name}")));
        if (!afterGuiBuild)
            Check("groups.reference-count", groups.Select(g => g.ReferenceCount).SequenceEqual(plan.Groups.Select(g => g.ReferenceCount)), "referenceCountField as written");

        var donorImages = donor.Resources.Where(r => r.Type == "PBImageResource").Select(r => r.Name).ToHashSet(StringComparer.Ordinal);
        foreach (var image in plan.Images)
        {
            var hits = model.Resources.Where(r => r.Type == "PBImageResource" && r.Name == image.ResourceName).ToArray();
            Check($"resource.{image.Key}", hits.Length == 1 && hits[0].Width == image.Width && hits[0].Height == image.Height && !donorImages.Contains(image.ResourceName),
                $"{image.ResourceName}: {hits.Length} found, {hits.FirstOrDefault()?.Width}x{hits.FirstOrDefault()?.Height}");
        }
        var referenced = models.SelectMany(p => p.Controls).SelectMany(c => c.States).Select(s => s.Image).Where(n => n != null).Distinct();
        Check("resource.references", referenced.All(n => names.Contains(n!)), "every state image names an existing image resource");
        if (!afterGuiBuild)
            Check("resource.donor-kept", donor.Resources.All(d => model.Resources.Any(r => r.Type == d.Type && r.Name == d.Name)), "donor resources retained");
        return checks;

        void CheckElement(PlanElement e, ContainerModel page, string at)
        {
            var found = page.Controls.Where(c => c.ObjectId == e.ObjectId && !BuildOwned(c)).ToArray();
            if (found.Length != 1) { Check($"{at}.present", false, $"objectId {e.ObjectId} found {found.Length} time(s)"); return; }
            var c = found[0];
            Check($"{at}.type", c.Type == Types[e.Kind], c.Type);
            Check($"{at}.control-id", c.ControlId == e.ControlId, $"userId {c.ControlId} (expected {e.ControlId})");
            Check($"{at}.key", c.Comments == "exui-key=" + e.Key, c.Comments ?? "null");
            Check($"{at}.name", c.Name == e.Name, c.Name);
            Check($"{at}.rect", c.Left == e.Rect[0] && c.Top == e.Rect[1] && c.Width == e.Rect[2] && c.Height == e.Rect[3], $"{c.Left},{c.Top},{c.Width},{c.Height}");
            switch (e.Kind)
            {
                case "label":
                    Check($"{at}.text", c.Text == e.Text, c.Text ?? "null");
                    if (e.TextColor != null) Check($"{at}.text-color", c.TextColor == Argb(e.TextColor), Hex(c.TextColor));
                    break;
                case "level":
                    Check($"{at}.level", c.Level != null && c.Level.DisplayType == LevelDisplay[e.Display!] && c.Level.Orientation == LevelOrientation[e.Orientation!]
                        && c.Level.Min == (uint)e.Min! && c.Level.Max == (uint)e.Max!,
                        c.Level == null ? "no level" : $"display {c.Level.DisplayType}, orientation {c.Level.Orientation}, {c.Level.Min}..{c.Level.Max}");
                    if (e.FillColor != null) Check($"{at}.fill", c.Level?.Fill == Argb(e.FillColor), Hex(c.Level?.Fill));
                    break;
                case "button":
                    var want = e.States!;
                    Check($"{at}.state-count", c.States.Count == want.Count, $"{c.States.Count} state(s)");
                    for (int i = 0; i < Math.Min(want.Count, c.States.Count); i++)
                    {
                        var s = c.States[i]; var w = want[i];
                        Check($"{at}.state{i}", s.Name == w.Name && s.Id == (ulong)i && s.Index == i && s.Text == w.Text && s.Image == w.Image
                            && s.Fill == Argb(w.Fill) && s.TextColor == Argb(w.TextColor),
                            $"{s.Name}: text '{s.Text}', fill {Hex(s.Fill)}, text {Hex(s.TextColor)}, image {s.Image ?? "none"}, id {s.Id}/{s.Index}");
                    }
                    Check($"{at}.press-feedback", c.PressFeedbackState == e.PressState, $"press state {c.PressFeedbackState}");
                    var looks = c.States.Select(s => (s.Text, s.Fill, s.TextColor, s.Image)).ToArray();
                    Check($"{at}.states-distinct", looks.Distinct().Count() == looks.Length, "every state has its own look");
                    break;
                case "popup-ref":
                    var b = c.PopupBinding;
                    if (e.Popup != null)
                    {
                        var target = plan.Popups.Single(p => p.Key == e.Popup);
                        Check($"{at}.binding", b != null && !b.Modal && b.PopupId == (ulong)target.ObjectId && b.GroupId == 0 && b.PopupName == target.Name,
                            b == null ? "no binding" : $"popup {b.PopupId} '{b.PopupName}', group {b.GroupId}, modal {b.Modal}");
                    }
                    else
                    {
                        var group = plan.Groups.Single(g => g.Key == e.Group);
                        Check($"{at}.binding", b != null && !b.Modal && b.PopupId == None && b.GroupId == group.GroupId && b.GroupName == group.Name,
                            b == null ? "no binding" : $"popup {b.PopupId}, group {b.GroupId} '{b.GroupName}', modal {b.Modal}");
                    }
                    break;
            }
        }
    }

    public static uint Argb(string hex)
    {
        string h = hex[1..];
        if (h.Length == 6) h = "FF" + h;
        return Convert.ToUInt32(h, 16);
    }

    private static string Hex(uint? argb) => argb is { } v ? $"#{v:X8}" : "none";
}
