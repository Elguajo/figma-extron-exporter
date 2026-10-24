using System.Security.Cryptography;
using System.Text.Json;
using static ExtronExporter.Format.NrbfDocument;

namespace ExtronExporter.Format;

public sealed record LayoutUpdateItem(int ControlId, string Page, string Name, string? IncomingName, bool CanUpdate,
    string Status, string Reason, string? BeforeCaption, string? AfterCaption, string? BeforePreview, string? AfterPreview);
public sealed record LayoutUpdatePlan(string Schema, string BaseSha256, string SourceSha256, string Panel,
    IReadOnlyList<LayoutUpdateItem> Items, bool GcpVerified = false);
public sealed record LayoutUpdateSelection(string Schema, string BaseSha256, string SourceSha256, int[] ControlIds, bool IncludeGeometry = false);
public sealed record LayoutUpdateResult(byte[] Gdl, int[] UpdatedIds, int ImportedResources, bool GcpVerified = false);

/// <summary>Imports only selected button appearance. The existing project remains authoritative for identity and behavior.</summary>
public static class LayoutReconciliation
{
    private static readonly HashSet<string> Paint = new(StringComparer.Ordinal)
    {
        "textField", "ftextField", "fontField", "textColorField", "textAlignmentField", "flattenTextField",
        "borderField", "borderFillColorField", "borderColorField", "transparencyField",
        "backgroundFillColorField", "backgroundImageField", "backgroundImageLayoutField", "backgroundImageAlignmentField",
        "backgroundImageKeyColorField", "backgroundImageLeftField", "backgroundImageTopField",
        "buttonImageField", "buttonImageLayoutField", "buttonImageAlignmentField", "buttonImageKeyColorField",
        "buttonImageLeftField", "buttonImageTopField"
    };
    private static readonly HashSet<string> Geometry = new(StringComparer.Ordinal) { "leftField", "topField", "widthField", "heightField" };
    private static string Bare(string name) => name[(name.LastIndexOf('+') + 1)..];
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
    private sealed record Button(NrbfNode Container, NrbfNode Node, ControlModel Model, ContainerModel Page);

    public static LayoutUpdatePlan Compare(byte[] existingGdl, byte[] incomingGdl)
    {
        var (before, after, oldDoc, newDoc) = Open(existingGdl, incomingGdl);
        var oldButtons = Buttons(oldDoc, before); var newButtons = Buttons(newDoc, after);
        var items = new List<LayoutUpdateItem>();
        foreach (var old in oldButtons)
        {
            var candidates = newButtons.Where(b => b.Model.ControlId == old.Model.ControlId).ToArray();
            var next = candidates.Length == 1 ? candidates[0] : null;
            string? issue = next == null ? "Нет кнопки с таким ID в новом макете; существующая останется." : Conflict(old, next);
            items.Add(new(old.Model.ControlId, old.Page.Name, old.Model.Name, next?.Model.Name, issue == null,
                next == null ? "missing" : issue == null ? "matched" : "conflict", issue ?? "Можно обновить оформление. ID, имена и поведение сохраняются.",
                old.Model.States.FirstOrDefault()?.Text, next?.Model.States.FirstOrDefault()?.Text,
                Preview(oldDoc, old.Model), next == null ? null : Preview(newDoc, next.Model)));
        }
        foreach (var added in newButtons.Where(n => oldButtons.All(o => o.Model.ControlId != n.Model.ControlId)))
            items.Add(new(added.Model.ControlId, added.Page.Name, added.Model.Name, added.Model.Name, false, "new",
                "Новая кнопка: режим обновления оформления её не добавляет.", null, added.Model.States.FirstOrDefault()?.Text, null, Preview(newDoc, added.Model)));
        return new("exui-layout-update/1", Hash(ExtronContainer.Parse(existingGdl).Payload), Hash(ExtronContainer.Parse(incomingGdl).Payload), before.Platform.PartNumber ?? before.Platform.PlatformClass, items);
    }

    public static LayoutUpdateResult Apply(byte[] existingGdl, byte[] incomingGdl, LayoutUpdateSelection selection)
    {
        if (selection.Schema != "exui-layout-selection/1" || selection.ControlIds == null || selection.ControlIds.Length == 0 ||
            selection.ControlIds.Distinct().Count() != selection.ControlIds.Length)
            throw new InvalidDataException("Select at least one distinct existing button ID.");
        var originalContainer = ExtronContainer.Parse(existingGdl); var sourceContainer = ExtronContainer.Parse(incomingGdl);
        if (selection.BaseSha256 != Hash(originalContainer.Payload) || selection.SourceSha256 != Hash(sourceContainer.Payload))
            throw new InvalidDataException("A layout changed after comparison; compare it again before applying a selection.");
        var (before, after, baseline, source) = Open(existingGdl, incomingGdl);
        var work = Read(originalContainer.Payload);
        var oldButtons = Buttons(baseline, before); var workButtons = Buttons(work, before); var newButtons = Buttons(source, after);
        var allowed = new HashSet<(NrbfNode, string)>();
        var selected = new List<(Button Before, Button After)>();
        foreach (int id in selection.ControlIds)
        {
            var old = oldButtons.SingleOrDefault(b => b.Model.ControlId == id);
            var next = newButtons.SingleOrDefault(b => b.Model.ControlId == id);
            if (old == null || next == null || Conflict(old, next) is { }) throw new InvalidDataException($"Button {id} is not eligible for appearance update.");
            selected.Add((old, next));
        }

        var oldResourceList = Child(Child(baseline.Root, "resourceSetField"), "resourcesField");
        var workResourceList = Child(Child(work.Root, "resourceSetField"), "resourcesField");
        var oldResources = Items(oldResourceList); var workResources = Items(workResourceList).ToList();
        var sourceResources = Items(Child(Child(source.Root, "resourceSetField"), "resourcesField"))
            .ToDictionary(r => Text(r, "nameField") ?? throw new InvalidDataException("Unnamed resource."), StringComparer.OrdinalIgnoreCase);
        var resourceNames = new HashSet<string>(workResources.Select(r => Text(r, "nameField")!), StringComparer.OrdinalIgnoreCase);
        var renamed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var imported = new Dictionary<NrbfNode, NrbfNode>();
        var queue = new Queue<(NrbfNode From, NrbfNode To)>();
        NrbfNode Import(NrbfNode node)
        {
            if (imported.TryGetValue(node, out var copy)) return copy;
            if (imported.Count >= 100000) throw new NotSupportedException("Imported appearance graph is too large.");
            copy = Copy(node); imported.Add(node, copy); queue.Enqueue((node, copy)); return copy;
        }
        object? ImportValue(object? value) => value is NrbfNode n ? Import(n) : value;
        void PaintFields(NrbfNode old, NrbfNode target, NrbfNode next, bool geometry = false)
        {
            foreach (string name in old.Fields!.Keys)
                if (Paint.Contains(Bare(name)) || geometry && Geometry.Contains(Bare(name)))
                {
                    if (!next.Fields!.TryGetValue(name, out var value)) throw new NotSupportedException($"Incoming appearance has no {name}.");
                    target.Fields![name] = ImportValue(value); allowed.Add((old, name));
                }
        }
        foreach (var (old, next) in selected)
        {
            var target = workButtons.Single(b => b.Model.ControlId == old.Model.ControlId);
            PaintFields(old.Node, target.Node, next.Node, selection.IncludeGeometry);
            var oldStates = Items(Child(old.Node, "statesField")); var targetStates = Items(Child(target.Node, "statesField")); var newStates = Items(Child(next.Node, "statesField"));
            // Clone the ownership path; a shared old state must never repaint an unselected button.
            var states = Copy(Child(target.Node, "statesField")); var list = Copy(Child(states, "mItems")); var array = Copy(Child(list, "_items"));
            Set(states, "mItems", list); Set(list, "_items", array); Set(target.Node, "statesField", states); allowed.Add((old.Node, Member(old.Node, "statesField")));
            for (int i = 0; i < oldStates.Length; i++)
            {
                var state = Copy(targetStates[i]); PaintFields(oldStates[i], state, newStates[i]);
                ResetImageId(state); ((NrbfNode?[])array.Values!)[i] = state;
                AssertEquivalent(oldStates[i], state, (n, field) => allowed.Contains((n, field)) || Bare(field) == "<TLPImageID>k__BackingField");
            }
            ResetImageId(target.Node); allowed.Add((old.Node, Member(old.Node, "<TLPImageID>k__BackingField")));
        }
        while (queue.TryDequeue(out var pair))
        {
            var (from, to) = pair;
            if (from.Type.EndsWith("PBColor", StringComparison.Ordinal) && Convert.ToInt32(Get(from, "paletteIndexField")) >= 0)
                throw new NotSupportedException("Incoming palette colors must be converted to explicit colors before updating.");
            if (from.Fields != null)
            {
                foreach (var (name, value) in from.Fields) to.Fields![name] = ImportValue(value);
                if (from.Fields.Keys.Any(k => Bare(k) == "resourceNameField") && Text(from, "resourceNameField") is { Length: > 0 } resource)
                {
                    if (!sourceResources.TryGetValue(resource, out var definition)) throw new InvalidDataException($"Missing source resource {resource}.");
                    if (!renamed.TryGetValue(resource, out var newName))
                    {
                        string stem = "exui-update-" + selection.SourceSha256[..8].ToLowerInvariant() + "-" + (renamed.Count + 1);
                        newName = stem; int suffix = 1; while (!resourceNames.Add(newName)) newName = stem + "-" + suffix++;
                        renamed.Add(resource, newName); var importedResource = Import(definition);
                        workResources.Add(importedResource);
                    }
                    Set(to, "resourceNameField", new NrbfNode { Type = "System.String", Text = newName });
                }
                // Resource definitions can be queued before/after the referencing node.
                if (sourceResources.Values.Contains(from) && Text(from, "nameField") is { } originalName && renamed.TryGetValue(originalName, out var replacement))
                    Set(to, "nameField", new NrbfNode { Type = "System.String", Text = replacement });
            }
            else if (from.Values is NrbfNode?[] values) to.Values = values.Select(v => v == null ? null : Import(v)).ToArray();
        }
        var resourceArray = Copy(Child(workResourceList, "_items")); resourceArray.Values = workResources.Cast<NrbfNode?>().ToArray();
        Set(workResourceList, "_items", resourceArray); Set(workResourceList, "_size", workResources.Count);
        Set(workResourceList, "_version", checked((int)Get(workResourceList, "_version")! + renamed.Count));
        foreach (string field in new[] { "_items", "_size", "_version" }) allowed.Add((oldResourceList, Member(oldResourceList, field)));
        var build = Copy(Child(work.Root, "buildStatusField")); Set(build, "value__", 1); // BuildStatusEnum.Needed, pinned 1.28.0.7
        Set(work.Root, "buildStatusField", build); allowed.Add((baseline.Root, Member(baseline.Root, "buildStatusField")));
        AssertEquivalent(baseline.Root, work.Root, (node, field) => allowed.Contains((node, field)));
        for (int i = 0; i < oldResources.Length; i++) AssertEquivalent(oldResources[i], workResources[i]);
        byte[] payload = work.Write();
        var resultModel = ProjectModel.Read(payload);
        if (resultModel.ProjectId != before.ProjectId || resultModel.DefaultPage != before.DefaultPage) throw new InvalidDataException("Project identity changed.");
        foreach (var c in resultModel.Pages.Concat(resultModel.Popups))
            if (c.Controls.Any(b => b.Left < 0 || b.Top < 0 || b.Width < 1 || b.Height < 1 || b.Left + (long)b.Width > c.Width || b.Top + (long)b.Height > c.Height))
                throw new InvalidDataException($"Updated control is outside page {c.Name}.");
        byte[] result = originalContainer.RepackEditablePayload(payload);
        if (!ExtronContainer.Parse(result).Payload.AsSpan().SequenceEqual(payload)) throw new InvalidDataException("Container changed updated payload.");
        return new(result, selection.ControlIds.ToArray(), renamed.Count);
    }

    private static void ResetImageId(NrbfNode node)
    { foreach (string key in node.Fields!.Keys.ToArray()) if (Bare(key) == "<TLPImageID>k__BackingField") node.Fields[key] = -1; }

    private static (ProjectModel Before, ProjectModel After, NrbfDocument Old, NrbfDocument New) Open(byte[] oldBytes, byte[] newBytes)
    {
        var old = ExtronContainer.Parse(oldBytes); var next = ExtronContainer.Parse(newBytes);
        var a = ProjectModel.Read(old.Payload); var b = ProjectModel.Read(next.Payload);
        if (a.AppVersion != "1.28.0.7" || b.AppVersion != a.AppVersion || a.Checksum != 0 || b.Checksum != 0)
            throw new NotSupportedException("Layout update currently requires GUI Designer 1.28.0.7 with zero project checksum.");
        if (a.Platform != b.Platform) throw new InvalidDataException("Layouts use different panel profiles.");
        return (a, b, Read(old.Payload), Read(next.Payload));
    }
    private static List<Button> Buttons(NrbfDocument doc, ProjectModel model)
    {
        var result = new List<Button>();
        foreach (var container in Items(Child(doc.Root, "pagesField")).Concat(Items(Child(doc.Root, "popupPagesField"))))
        {
            ulong id = Convert.ToUInt64(Get(container, "idField"));
            var page = model.Pages.Concat(model.Popups).Single(p => p.ObjectId == id);
            foreach (var control in Items(Child(container, "controlsField")).Where(n => n.Type == "Extron.GUICPro.PBButton"))
            {
                ulong objectId = Convert.ToUInt64(Get(control, "idField"));
                result.Add(new(container, control, page.Controls.Single(c => c.ObjectId == objectId), page));
            }
        }
        if (result.Any(b => b.Model.ControlId == 0) || result.GroupBy(b => b.Model.ControlId).Any(g => g.Count() != 1))
            throw new InvalidDataException("Button IDs must be nonzero and unique throughout the project.");
        return result;
    }
    private static string? Conflict(Button old, Button next)
    {
        if (old.Model.ObjectId != next.Model.ObjectId || old.Page.ObjectId != next.Page.ObjectId || old.Page.Type != next.Page.Type)
            return "ID управления совпал, но объект или страница отличаются. Автоматическая замена заблокирована.";
        if (old.Model.States.Count != next.Model.States.Count ||
            !old.Model.States.Select(s => (s.Id, s.Name, s.Index)).SequenceEqual(next.Model.States.Select(s => (s.Id, s.Name, s.Index))))
            return "Изменены ID, имена или порядок состояний. Нужна отдельная проверка.";
        if (old.Model.States.Count == 0) return "У кнопки нет состояний.";
        if (old.Model.Comments != next.Model.Comments) return "Служебный ключ/описание отличается: возможна другая функция с тем же ID.";
        return null;
    }
    private static string? Preview(NrbfDocument doc, ControlModel button)
    {
        string? name = button.States.FirstOrDefault()?.Image;
        if (name == null) return null;
        var resource = Items(Child(Child(doc.Root, "resourceSetField"), "resourcesField")).SingleOrDefault(r => Text(r, "nameField") == name);
        if (resource == null || Get(resource, "dataField") is not NrbfNode bitmap || bitmap.Fields?.TryGetValue("Data", out var data) != true || data is not NrbfNode array || array.Values is not byte[] bytes || bytes.Length > 4 * 1024 * 1024) return null;
        return Convert.ToBase64String(bytes);
    }
}
