using System.Text.Json;
using ExtronExporter.Format;

namespace ExtronExporter.Screen;

public sealed record FigmaOriginNode(string NodeId, string Key, int ControlId, string Name);
public sealed record FigmaOrigin(string Schema, string PageId, string PageToken, string ProjectName, FigmaOriginNode[] Nodes);
public sealed record FigmaIdMapEntry(string NodeId, string Key, int SourceControlId, int ControlId, string Name);
public sealed record FigmaIdMap(string Schema, string Profile, string PageId, string PageToken, string ProjectName, FigmaIdMapEntry[] Entries)
{
    public static FigmaIdMap Create(FigmaOrigin origin, string profile, byte[] baseline, byte[] incoming, LayoutUpdateSelection selection)
    {
        var plan = LayoutReconciliation.Compare(baseline, incoming, selection.RebindByControlId, selection.Bindings);
        if (selection.Schema != "exui-layout-selection/1" || selection.ControlIds == null || plan.BaseSha256 != selection.BaseSha256 || plan.SourceSha256 != selection.SourceSha256 || selection.ControlIds.Length == 0 || selection.ControlIds.Distinct().Count() != selection.ControlIds.Length)
            throw new InvalidDataException("Сравнение устарело или выбор кнопок пуст.");
        var entries = new List<FigmaIdMapEntry>();
        var usedNodes = new HashSet<string>();
        var model = ProjectModel.Read(ExtronContainer.Parse(incoming).Payload);
        var incomingControls = model.Pages.Concat(model.Popups).SelectMany(c => c.Controls).ToArray();
        foreach (int id in selection.ControlIds)
        {
            var row = plan.Items.SingleOrDefault(i => i.ControlId == id && i.Status != "new");
            if (row is not { CanUpdate: true, SourceControlId: { } sourceId }) throw new InvalidDataException($"Кнопка {id} не готова к сопоставлению.");
            var source = origin.Nodes.SingleOrDefault(n => n.ControlId == sourceId) ?? throw new InvalidDataException($"Для кнопки {sourceId} нет исходного слоя Figma.");
            if (!incomingControls.Any(c => c.ControlId == sourceId && c.Comments == "exui-key=" + source.Key)) throw new InvalidDataException("Исходные слои не соответствуют новому GDL. Выберите тот же EXUI, из которого он создан.");
            if (!usedNodes.Add(source.NodeId)) throw new InvalidDataException("Одна кнопка Figma выбрана для нескольких кнопок GUI Designer.");
            entries.Add(new(source.NodeId, source.Key, source.ControlId, id, source.Name));
        }
        return new("exui-figma-id-map/1", profile, origin.PageId, origin.PageToken, origin.ProjectName, entries.ToArray());
    }

    public LayoutButtonBinding[] BindTo(FigmaOrigin origin, string profile)
    {
        if (Schema != "exui-figma-id-map/1" || Profile != profile || PageId != origin.PageId || PageToken != origin.PageToken || Entries is not { Length: > 0 and <= 256 } ||
            Entries.Any(e => e == null || e.ControlId is < 1 or > 65535) || Entries.Select(e => e.NodeId).Distinct().Count() != Entries.Length || Entries.Select(e => e.ControlId).Distinct().Count() != Entries.Length)
            throw new InvalidDataException("Карта относится к другому макету или содержит повторяющиеся назначения.");
        return Entries.Select(e => new LayoutButtonBinding(e.ControlId, origin.Nodes.SingleOrDefault(n => n.NodeId == e.NodeId)?.ControlId
            ?? throw new InvalidDataException($"Слой {e.Name} отсутствует в новом экспорте. Сопоставьте кнопки заново."))).ToArray();
    }
}
