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

    private static readonly Dictionary<string, string> Types = new() { ["button"] = "PBButton", ["label"] = "PBLabel", ["level"] = "PBLevel" };

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

    public static IReadOnlyList<CheckResult> Verify(GeneratePlan plan, ProjectModel model, ProjectModel donor, ExpectedProfile expected)
    {
        var checks = new List<CheckResult>(ProfileChecks(model, expected));
        void Check(string id, bool ok, string detail) => checks.Add(new(id, ok, detail));

        Check("project.name", model.Name == plan.ProjectName, model.Name);
        Check("page.count", model.Pages.Count == 1, $"{model.Pages.Count} page(s)");
        Check("page.default", model.DefaultPage == plan.Page.ObjectId, $"defaultPage {model.DefaultPage}");
        var page = model.Pages.FirstOrDefault();
        if (page == null) return checks;
        Check("page.ids", page.ObjectId == (ulong)plan.Page.ObjectId && page.ControlId == plan.Page.ObjectId, $"id {page.ObjectId}, userId {page.ControlId}");
        Check("page.name", page.Name == plan.Page.Name, page.Name);
        Check("page.key", page.Comments == "exui-key=" + plan.Page.Key, page.Comments ?? "null");
        Check("page.size", page.Width == expected.Width && page.Height == expected.Height, $"{page.Width}x{page.Height}");
        if (plan.Page.Background != null) Check("page.background", page.Background == Argb(plan.Page.Background), Hex(page.Background));
        Check("page.controls", page.Controls.Count == plan.Elements.Count, $"{page.Controls.Count} control(s), expected {plan.Elements.Count}");
        Check("page.object-ids-unique", page.Controls.Select(c => c.ObjectId).Distinct().Count() == page.Controls.Count, "idField unique within page");

        foreach (var e in plan.Elements)
        {
            string at = $"element.{e.Key}";
            var found = page.Controls.Where(c => c.ObjectId == e.ObjectId).ToArray();
            if (found.Length != 1) { Check($"{at}.present", false, $"objectId {e.ObjectId} found {found.Length} time(s)"); continue; }
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
            }
        }

        var donorImages = donor.Resources.Where(r => r.Type == "PBImageResource").Select(r => r.Name).ToHashSet(StringComparer.Ordinal);
        foreach (var image in plan.Images)
        {
            var hits = model.Resources.Where(r => r.Type == "PBImageResource" && r.Name == image.ResourceName).ToArray();
            Check($"resource.{image.Key}", hits.Length == 1 && hits[0].Width == image.Width && hits[0].Height == image.Height && !donorImages.Contains(image.ResourceName),
                $"{image.ResourceName}: {hits.Length} found, {hits.FirstOrDefault()?.Width}x{hits.FirstOrDefault()?.Height}");
        }
        var referenced = page.Controls.SelectMany(c => c.States).Select(s => s.Image).Where(n => n != null).Distinct();
        var names = model.Resources.Where(r => r.Type == "PBImageResource").Select(r => r.Name).ToHashSet(StringComparer.Ordinal);
        Check("resource.references", referenced.All(n => names.Contains(n!)), "every state image names an existing image resource");
        Check("resource.donor-kept", donor.Resources.All(d => model.Resources.Any(r => r.Type == d.Type && r.Name == d.Name)), "donor resources retained");
        Check("popups.unchanged", model.Popups.Select(p => (p.ObjectId, p.Name, p.Width, p.Height)).SequenceEqual(donor.Popups.Select(p => (p.ObjectId, p.Name, p.Width, p.Height))),
            string.Join(", ", model.Popups.Select(p => $"{p.ObjectId}:{p.Name}")));
        return checks;
    }

    public static uint Argb(string hex)
    {
        string h = hex[1..];
        if (h.Length == 6) h = "FF" + h;
        return Convert.ToUInt32(h, 16);
    }

    private static string Hex(uint? argb) => argb is { } v ? $"#{v:X8}" : "none";
}
