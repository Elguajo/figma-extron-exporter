using System.Text;
using System.Text.Json;

namespace ExtronExporter.Screen;

public sealed record ComparisonSnapshot(string Sha256, string ProjectName, ExuiProfile Profile);
public sealed record ComparisonIdentity(string Key, string Kind, string Name, string? Container,
    int? ContainerId, ulong ObjectId, int? ControlId);
public sealed record ComparisonChange(string Field, string Severity, string Before, string After);
public sealed record ComparisonItem(string Status, string MatchedBy, ComparisonIdentity? Before,
    ComparisonIdentity? After, IReadOnlyList<ComparisonChange> Changes);
public sealed record PackageComparisonReport(string Schema, ComparisonSnapshot Before, ComparisonSnapshot After,
    bool GcpVerified, IReadOnlyList<ComparisonChange> ProjectChanges, IReadOnlyList<ComparisonItem> Items)
{
    public bool RequiresReview => ProjectChanges.Any(c => c.Severity != "info") ||
        Items.Any(i => i.Status is "added" or "removed" || i.Changes.Any(c => c.Severity != "info"));
}

/// <summary>Compare validated exports, without mutating them or inferring GCP configuration.</summary>
public static class PackageComparison
{
    private sealed record Entry(ComparisonIdentity Identity, object Value);
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static PackageComparisonReport Compare(ExuiPackage before, ExuiPackage after)
    {
        var project = new List<ComparisonChange>();
        Add(project, "profile", "breaking", before.Profile, after.Profile);
        Add(project, "projectName", "review", before.Plan.ProjectName, after.Plan.ProjectName);
        Add(project, "startPage", "review", Start(before.Plan), Start(after.Plan));
        Add(project, "pageOrder", "info", before.Plan.Pages.Select(c => c.ObjectId).ToArray(), after.Plan.Pages.Select(c => c.ObjectId).ToArray());
        Add(project, "popupOrder", "review", before.Plan.Popups.Select(c => c.ObjectId).ToArray(), after.Plan.Popups.Select(c => c.ObjectId).ToArray());
        var items = new List<ComparisonItem>();
        CompareEntries(Containers(before.Plan), Containers(after.Plan), ContainerIdentity, (a, b, changes) =>
        {
            var x = (PlanContainer)a.Value; var y = (PlanContainer)b.Value;
            Add(changes, "modal", "review", x.Modal, y.Modal);
            Add(changes, "group", "review", Group(before.Plan, x.Group), Group(after.Plan, y.Group));
            Add(changes, "shownBy", "review", x.ShownBy, y.ShownBy);
            var commonIds = x.Elements.Select(e => e.ObjectId).Intersect(y.Elements.Select(e => e.ObjectId)).ToHashSet();
            Add(changes, "stackingOrder", "review", x.Elements.Where(e => commonIds.Contains(e.ObjectId)).Select(e => e.ObjectId).ToArray(),
                y.Elements.Where(e => commonIds.Contains(e.ObjectId)).Select(e => e.ObjectId).ToArray());
            Add(changes, "appearance", "info", new { x.Background, x.Width, x.Height }, new { y.Background, y.Width, y.Height });
        });
        CompareEntries(Groups(before.Plan), Groups(after.Plan), ContainerIdentity, (a, b, changes) =>
        {
            var x = (PlanGroup)a.Value; var y = (PlanGroup)b.Value;
            Add(changes, "members", "review", Members(before.Plan, x.Key), Members(after.Plan, y.Key));
        });
        CompareEntries(Elements(before.Plan), Elements(after.Plan), ElementIdentity, (a, b, changes) =>
        {
            var x = (PlanElement)a.Value; var y = (PlanElement)b.Value;
            Add(changes, "container", "review", new { a.Identity.ContainerId, a.Identity.Container }, new { b.Identity.ContainerId, b.Identity.Container });
            Add(changes, "states", "breaking", StateRoles(x), StateRoles(y));
            Add(changes, "stateNames", "review", x.States?.Select(s => s.Name).ToArray(), y.States?.Select(s => s.Name).ToArray());
            Add(changes, "pressState", "breaking", x.PressState, y.PressState);
            Add(changes, "range", "review", new { x.Min, x.Max }, new { y.Min, y.Max });
            Add(changes, "display", "review", new { x.Display, x.Orientation }, new { y.Display, y.Orientation });
            Add(changes, "navigate", "review", Target(before.Plan, x.Navigate), Target(after.Plan, y.Navigate));
            Add(changes, "popup", "review", Target(before.Plan, x.Popup), Target(after.Plan, y.Popup));
            Add(changes, "group", "review", Group(before.Plan, x.Group), Group(after.Plan, y.Group));
            Add(changes, "behavior", "review", x.Behavior, y.Behavior);
            CompareAppearance(before.Plan, x, after.Plan, y, changes);
        });
        return new("exui-comparison/1", Snapshot(before), Snapshot(after), false, project, items);

        void CompareEntries(List<Entry> oldEntries, List<Entry> newEntries, Func<Entry, Entry, bool> sameIdentity,
            Action<Entry, Entry, List<ComparisonChange>> compare)
        {
            var unmatched = new HashSet<Entry>(newEntries);
            var matches = new Dictionary<Entry, (Entry Entry, string By)>();
            // Reserve all key matches first: an ID swap must not steal another element's match.
            Match("key", (a, b) => a.Identity.Key == b.Identity.Key);
            Match("objectId", sameIdentity);
            Match("controlId-only", (a, b) => a.Identity.ControlId is > 0 && a.Identity.ControlId == b.Identity.ControlId);
            foreach (var a in oldEntries)
            {
                if (!matches.TryGetValue(a, out var match))
                {
                    items.Add(new("removed", "none", a.Identity, null,
                        [new("presence", "breaking", "present", "removed")]));
                    continue;
                }
                var b = match.Entry;
                var changes = new List<ComparisonChange>();
                if (match.By == "controlId-only") changes.Add(new("identity", "breaking", "previous controlId", "possible ID reuse or replacement; verify manually"));
                Add(changes, "key", "info", a.Identity.Key, b.Identity.Key);
                Add(changes, "kind", "breaking", a.Identity.Kind, b.Identity.Kind);
                Add(changes, "objectId", "review", a.Identity.ObjectId, b.Identity.ObjectId);
                Add(changes, "controlId", "breaking", a.Identity.ControlId, b.Identity.ControlId);
                Add(changes, "name", "review", a.Identity.Name, b.Identity.Name);
                compare(a, b, changes);
                // A stable key can still be reassigned to another control, including an ID swap.
                if (b.Identity.ControlId is > 0 && oldEntries.Any(other => other != a && other.Identity.ControlId == b.Identity.ControlId))
                    changes.Add(new("controlIdReuse", "breaking", "ID belonged to another element", b.Identity.ControlId.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)));
                items.Add(new(changes.Count == 0 ? "unchanged" : "modified", match.By, a.Identity, b.Identity, changes));
            }
            foreach (var b in newEntries.Where(unmatched.Contains))
                items.Add(new("added", "none", null, b.Identity, [new("presence", "review", "absent", "added")]));

            void Match(string by, Func<Entry, Entry, bool> predicate)
            {
                foreach (var a in oldEntries.Where(e => !matches.ContainsKey(e)))
                {
                    var candidates = unmatched.Where(b => predicate(a, b)).ToArray();
                    if (candidates.Length != 1) continue;
                    matches.Add(a, (candidates[0], by)); unmatched.Remove(candidates[0]);
                }
            }
        }
    }

    private static ComparisonSnapshot Snapshot(ExuiPackage p) => new(p.Sha256, p.Plan.ProjectName, p.Profile);
    private static object? Start(GeneratePlan p) => Target(p, p.StartPage);
    private static object? Target(GeneratePlan p, string? key) => key == null ? null : p.Containers
        .Where(c => c.Key == key).Select(c => new { c.ObjectId, c.Name, Kind = p.Pages.Contains(c) ? "page" : "popup" }).Single();
    private static object? Group(GeneratePlan p, string? key) => key == null ? null : p.Groups
        .Where(g => g.Key == key).Select(g => new { g.GroupId, g.Name }).Single();
    private static int[] Members(GeneratePlan p, string key) => p.Popups.Where(c => c.Group == key).Select(c => c.ObjectId).Order().ToArray();
    private static string[]? StateRoles(PlanElement e) => e.States?.Select(s => s.Role).ToArray();
    private static object? Image(GeneratePlan p, string? resource) => resource == null ? null : p.Images.Where(i => i.ResourceName == resource)
        .Select(i => new { i.Sha256, i.Width, i.Height, i.ResourceName }).Single();
    private static void CompareAppearance(GeneratePlan before, PlanElement x, GeneratePlan after, PlanElement y, List<ComparisonChange> changes)
    {
        Add(changes, "appearance.rect", "info", x.Rect, y.Rect);
        Add(changes, "appearance.text", "info", x.Text, y.Text);
        Add(changes, "appearance.textColor", "info", x.TextColor, y.TextColor);
        Add(changes, "appearance.font", "info", x.Font, y.Font);
        Add(changes, "appearance.fill", "info", x.FillColor, y.FillColor);
        Add(changes, "appearance.textAlign", "info", x.TextAlign, y.TextAlign);
        Add(changes, "appearance.native", "info", x.Native, y.Native);
        Add(changes, "appearance.image", "info", Image(before, x.Image), Image(after, y.Image));
        for (int id = 0; id < Math.Min(x.States?.Count ?? 0, y.States?.Count ?? 0); id++)
        {
            var a = x.States![id]; var b = y.States![id]; string field = $"appearance.state[{id}]";
            Add(changes, field + ".text", "info", a.Text, b.Text);
            Add(changes, field + ".fill", "info", a.Fill, b.Fill);
            Add(changes, field + ".textColor", "info", a.TextColor, b.TextColor);
            Add(changes, field + ".image", "info", Image(before, a.Image), Image(after, b.Image));
            Add(changes, field + ".imageAlign", "info", a.ImageAlign, b.ImageAlign);
            Add(changes, field + ".textAlign", "info", a.TextAlign, b.TextAlign);
        }
    }
    private static List<Entry> Containers(GeneratePlan p) => p.Containers.OrderBy(c => c.ObjectId).Select(c => new Entry(
        new(c.Key, p.Pages.Contains(c) ? "page" : "popup", c.Name, null, null, (ulong)c.ObjectId, null), c)).ToList();
    private static List<Entry> Groups(GeneratePlan p) => p.Groups.OrderBy(g => g.GroupId).Select(g => new Entry(
        new(g.Key, "popup-group", g.Name, null, null, (ulong)g.GroupId, null), g)).ToList();
    private static List<Entry> Elements(GeneratePlan p) => p.Containers.OrderBy(c => c.ObjectId)
        .SelectMany(c => c.Elements.OrderBy(e => e.ObjectId).Select(e => new Entry(
            new(e.Key, e.Kind, e.Name, c.Name, c.ObjectId, e.ObjectId, e.ControlId == 0 ? null : e.ControlId), e))).ToList();
    private static bool ContainerIdentity(Entry a, Entry b) => a.Identity.ObjectId == b.Identity.ObjectId;
    private static bool ElementIdentity(Entry a, Entry b) => a.Identity.ContainerId == b.Identity.ContainerId && a.Identity.ObjectId == b.Identity.ObjectId;
    private static void Add<T>(List<ComparisonChange> changes, string field, string severity, T before, T after)
    {
        string x = JsonSerializer.Serialize(before, Json), y = JsonSerializer.Serialize(after, Json);
        if (x != y) changes.Add(new(field, severity, x, y));
    }

    public static string Markdown(PackageComparisonReport report)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Сравнение экспортов Figma → Extron").AppendLine();
        sb.AppendLine($"До: {Cell(report.Before.ProjectName)} / {Cell(report.Before.Profile.Panel)}; SHA-256 `{report.Before.Sha256}`.");
        sb.AppendLine($"После: {Cell(report.After.ProjectName)} / {Cell(report.After.Profile.Panel)}; SHA-256 `{report.After.Sha256}`.").AppendLine();
        sb.AppendLine("Это сравнение EXUI, а не проверка сохранности назначений GCP. При обновлении макета используйте Layout Reconciliation в копии существующего проекта GCP и проверьте сохранение конфигурации.").AppendLine();
        sb.AppendLine($"Итог: {(report.RequiresReview ? "есть изменения, требующие проверки программистом" : "изменений адресации и поведения в EXUI не обнаружено; GCP не проверен")}.").AppendLine();
        foreach (string status in new[] { "unchanged", "modified", "added", "removed" })
            sb.AppendLine($"- {Status(status)}: {report.Items.Count(i => i.Status == status)}.");
        sb.AppendLine().AppendLine("Уровни: info — оформление/ключ; review — проверить настройки и связи; breaking — изменена адресация/состояния, удалён элемент или возможна подмена ID. Новым управляющим элементам нужно назначить логику; пассивные элементы её не требуют.").AppendLine();
        if (report.ProjectChanges.Count > 0)
        {
            sb.AppendLine("## Проект").AppendLine();
            foreach (var c in report.ProjectChanges) sb.AppendLine($"- **{c.Severity} / {c.Field}**: {Cell(c.Before)} → {Cell(c.After)}");
            sb.AppendLine();
        }
        sb.AppendLine("| Статус | Элемент до → после | ID управления до → после | Сопоставление | Изменения |");
        sb.AppendLine("|---|---|---|---|---|");
        foreach (var i in report.Items.Where(i => i.Status != "unchanged"))
        {
            sb.AppendLine($"| {Status(i.Status)} | {Describe(i.Before)} → {Describe(i.After)} | {i.Before?.ControlId?.ToString() ?? "—"} → {i.After?.ControlId?.ToString() ?? "—"} | {i.MatchedBy} | {string.Join("<br>", i.Changes.Select(c => $"**{c.Severity} / {c.Field}**: {Cell(c.Before)} → {Cell(c.After)}"))} |");
        }
        if (report.Items.All(i => i.Status == "unchanged")) sb.AppendLine("| Без изменений | Все элементы | сохранены | — | — |");
        sb.AppendLine().AppendLine("Совпадение ID не доказывает неизменность смысла кнопки. Удалённую и нарисованную заново кнопку нельзя автоматически считать прежней. Ручные правки старого GDL и настройки GCP этот отчёт не переносит.");
        return sb.ToString();
    }
    private static string Status(string status) => status switch { "unchanged" => "Без изменений", "modified" => "Изменён", "added" => "Добавлен", _ => "Удалён" };
    private static string Describe(ComparisonIdentity? i) => i == null ? "—" : Cell($"{i.Kind}: {i.Name} [{i.Key}]" + (i.Container == null ? "" : $" / {i.Container}"));
    private static string Cell(string value) => value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
        .Replace("|", "&#124;").Replace("`", "&#96;").Replace("\r", " ").Replace("\n", " ");
}
