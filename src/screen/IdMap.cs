using System.Text;

namespace ExtronExporter.Screen;

/// <summary>
/// What a control programmer receives with the panel: every addressable control with its ID and states, and
/// how each page and popup is reached. A .gdl stores no button behavior, so "navigate" is an instruction for
/// the control program, not something the panel does by itself.
/// </summary>
public static class IdMap
{
    public static string Markdown(GeneratePlan plan, string panel)
    {
        var all = plan.Containers.ToDictionary(c => c.Key, StringComparer.Ordinal);
        string NameOf(string key) => all.TryGetValue(key, out var c) ? $"{(plan.Pages.Contains(c) ? "страница" : "popup")} «{c.Name}»" : key;
        var sb = new StringBuilder();
        sb.AppendLine($"# Карта ID: {plan.ProjectName}").AppendLine();
        sb.AppendLine($"Панель: {panel}. Стартовая страница: «{plan.Page.Name}».").AppendLine();
        sb.AppendLine("Страницы и popup программа управления показывает по имени. Элемент адресуется по ID Extron (controlId). Поле «Ведёт к» — указание для программы: в GDL переходы не хранятся.").AppendLine();
        sb.AppendLine("| Контейнер | Тип | Имя | Как показывается |").AppendLine("|---|---|---|---|");
        foreach (var c in plan.Containers)
        {
            bool page = plan.Pages.Contains(c);
            string type = page ? "страница" : c.Modal ? "модальный popup" : "popup";
            string group = c.Group == null ? "" : $", группа «{plan.Groups.Single(g => g.Key == c.Group).Name}»";
            string how = c.ShownBy switch
            {
                "start" => "стартовая",
                "navigation" => "по кнопке: " + string.Join(", ", plan.Containers.SelectMany(x => x.Elements).Where(e => e.Navigate == c.Key).Select(e => $"`{e.Key}` ({e.ControlId})")),
                _ => "показывает программа"
            };
            string placed = page || c.Modal ? "" : "; место задаёт " + string.Join(", ", plan.Pages.SelectMany(p => p.Elements
                .Where(e => e.Kind == "popup-ref" && (e.Popup == c.Key || (c.Group != null && e.Group == c.Group))).Select(e => $"`{e.Key}` на «{p.Name}»")));
            sb.AppendLine($"| `{c.Key}` | {type}{group} | {c.Name} | {how}{placed} |");
        }
        sb.AppendLine().AppendLine("| ID | Ключ | Тип | Имя | Где | Состояния | Ведёт к |").AppendLine("|---:|---|---|---|---|---|---|");
        foreach (var (c, e) in plan.Containers.SelectMany(c => c.Elements.Where(e => e.ControlId != 0).Select(e => (c, e))).OrderBy(x => x.e.ControlId))
        {
            string states = e.States == null ? "" : string.Join("; ", e.States.Select((s, i) => $"{i} {s.Name} ({s.Role})"));
            sb.AppendLine($"| {e.ControlId} | `{e.Key}` | {e.Kind} | {e.Name} | «{c.Name}» | {states} | {(e.Navigate == null ? "" : NameOf(e.Navigate))} |");
        }
        if (plan.Groups.Count > 0)
        {
            sb.AppendLine().AppendLine("| Группа popup | ID | Участники |").AppendLine("|---|---:|---|");
            foreach (var g in plan.Groups)
                sb.AppendLine($"| {g.Name} | {g.GroupId} | {string.Join(", ", plan.Popups.Where(p => p.Group == g.Key).Select(p => $"«{p.Name}»"))} |");
        }
        var behaviors = plan.Containers.SelectMany(c => c.Elements).Where(e => e.Behavior != null).ToArray();
        if (behaviors.Length > 0)
        {
            sb.AppendLine().AppendLine("## Поведение для программы управления").AppendLine();
            sb.AppendLine("Эти указания не исполняются самим GDL. Программа применяет доступность/видимость при запуске и обновляет группу выбора по обратной связи оборудования.").AppendLine();
            sb.AppendLine("| ID | Ключ | Группа выбора | Доступен при запуске | Виден при запуске |").AppendLine("|---:|---|---|---|---|");
            foreach (var e in behaviors) sb.AppendLine($"| {e.ControlId} | `{e.Key}` | {e.Behavior!.SelectionGroup ?? "—"} | {e.Behavior.Enabled?.ToString() ?? "без указания"} | {e.Behavior.Visible?.ToString() ?? "без указания"} |");
        }
        return sb.ToString();
    }
}
