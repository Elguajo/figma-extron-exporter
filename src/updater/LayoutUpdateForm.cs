using System.Security.Cryptography;
using System.Text.Json;
using ExtronExporter.Adapter;
using ExtronExporter.Format;
using ExtronExporter.Screen;

namespace ExtronExporter.Updater;

internal sealed class LayoutUpdateForm : Form
{
    private readonly TextBox baseline = new() { Dock = DockStyle.Fill, AccessibleName = "Рабочий GDL" };
    private readonly TextBox incoming = new() { Dock = DockStyle.Fill, AccessibleName = "Новое оформление EXUI или GDL" };
    private readonly Button compare = new() { Text = "Сравнить", AutoSize = true };
    private readonly Button save = new() { Text = "Сохранить выбранные изменения…", AutoSize = true, Enabled = false };
    private readonly Button saveIdMap = new() { Text = "Карта ID → Figma…", AutoSize = true, Enabled = false };
    private readonly Button loadIdMap = new() { Text = "Загрузить соответствия…", AutoSize = true, Enabled = false };
    private readonly Button bindInOrder = new() { Text = "Связать выделенные по порядку…", AutoSize = true, Enabled = false };
    private readonly CheckBox geometry = new() { Text = "Перенести также положение и размеры выбранных кнопок", AutoSize = true };
    private readonly CheckBox rebind = new() { Text = "Заменять оформление кнопок GUI Designer по ID управления", AutoSize = true };
    private readonly Label status = new() { Text = "Выберите рабочий GDL и новый экспорт Figma. Исходные файлы сохраняются.", Dock = DockStyle.Fill, AutoSize = true, AccessibleRole = AccessibleRole.StaticText };
    private readonly Label details = new() { Dock = DockStyle.Fill, AutoSize = true };
    private readonly DataGridView grid = new() { Dock = DockStyle.Fill, AllowUserToAddRows = false, AllowUserToDeleteRows = false,
        MultiSelect = true, SelectionMode = DataGridViewSelectionMode.FullRowSelect, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
        RowHeadersVisible = false, AccessibleName = "Выбор кнопок для обновления" };
    private readonly PictureBox oldImage = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.FromArgb(225, 225, 225), AccessibleName = "Оформление до обновления" };
    private readonly PictureBox newImage = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.FromArgb(225, 225, 225), AccessibleName = "Новое оформление" };
    private readonly string? registryPath;
    private bool busy;
    private LayoutUpdatePlan? plan;
    private byte[]? oldBytes, newBytes;
    private string? oldFileHash, incomingFileHash;
    private FigmaOrigin? origin;
    private string? originProfile;
    private readonly Dictionary<int,int> bindings = new();
    private bool rendering, mappingPending;

    public LayoutUpdateForm(string? basePath, string? newPath, string? registry)
    {
        Text = "Figma → Extron — обновление оформления GDL · " + typeof(LayoutUpdateForm).Assembly.GetName().Version?.ToString(3);
        MinimumSize = new Size(900, 680); Size = new Size(1160, 820); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); AutoScaleMode = AutoScaleMode.Dpi;
        registryPath = registry;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(18), ColumnCount = 1, RowCount = 7 };
        // Keep long paths and status messages within the window and let labels wrap.
        layout.ColumnStyles.Add(new(SizeType.Percent, 100));
        layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.AutoSize));
        layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.Percent, 60));
        layout.RowStyles.Add(new(SizeType.Percent, 40)); layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.AutoSize));
        layout.Controls.Add(new Label { Text = "Обновить выбранные кнопки", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Margin = new Padding(0, 0, 0, 12) }, 0, 0);
        var paths = new TableLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, ColumnCount = 3, RowCount = 2 };
        paths.ColumnStyles.Add(new(SizeType.Absolute, 180)); paths.ColumnStyles.Add(new(SizeType.Percent, 100)); paths.ColumnStyles.Add(new(SizeType.AutoSize));
        AddPath(paths, 0, "Рабочий GDL", baseline, "GUI Designer (*.gdl)|*.gdl");
        AddPath(paths, 1, "Новое оформление", incoming, "Экспорт Figma / GUI Designer|*.exui;*.gdl"); layout.Controls.Add(paths, 0, 1);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, Margin = new Padding(0, 10, 0, 10) };
        actions.Controls.Add(compare); actions.Controls.Add(geometry); actions.Controls.Add(rebind); layout.Controls.Add(actions, 0, 2);
        grid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "apply", HeaderText = "Обновить", FillWeight = 55 });
        foreach (var (name, title, width) in new[] { ("state", "Статус", 90), ("page", "Страница", 110), ("id", "ID GUI", 55), ("old", "Сейчас", 140) })
            grid.Columns.Add(new DataGridViewTextBoxColumn { Name = name, HeaderText = title, ReadOnly = true, FillWeight = width });
        grid.Columns.Add(new DataGridViewComboBoxColumn { Name = "new", HeaderText = "Новая кнопка Figma", DisplayMember = nameof(LayoutButtonChoice.Label), ValueMember = nameof(LayoutButtonChoice.ControlId), ValueType = typeof(int), FillWeight = 200 });
        grid.CellBeginEdit += (_, e) => { if (grid.Rows[e.RowIndex].Tag is not LayoutUpdateItem item || item.Status == "new" || e.ColumnIndex != 5 && !item.CanUpdate) e.Cancel = true; };
        grid.CurrentCellDirtyStateChanged += (_, _) => { if (grid.IsCurrentCellDirty) grid.CommitEdit(DataGridViewDataErrorContexts.Commit); };
        grid.CellValueChanged += (_, e) =>
        {
            if (!rendering && e.RowIndex >= 0 && e.ColumnIndex == 5 && grid.Rows[e.RowIndex].Tag is LayoutUpdateItem { Status: not "new" } item && grid.Rows[e.RowIndex].Cells[5].Value is int sourceId)
            {
                byte[]? old = oldBytes, next = newBytes; mappingPending = true; UpdateSave();
                BeginInvoke(new Action(() => { if (oldBytes != old || newBytes != next) return; try { bindings[item.ControlId] = sourceId; RebuildPlan(); } catch (Exception error) { InvalidatePlan(); status.Text = error.Message; } finally { mappingPending = false; UpdateSave(); } }));
            }
            UpdateSave();
        };
        grid.DataError += (_, e) => { e.ThrowException = false; status.Text = "Выберите кнопку из списка нового макета."; };
        grid.SelectionChanged += (_, _) => { if (!rendering) { Preview();UpdateSave(); } };
        layout.Controls.Add(grid, 0, 3);
        var previews = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 3, Margin = new Padding(0, 12, 0, 12) };
        previews.ColumnStyles.Add(new(SizeType.Percent, 50)); previews.ColumnStyles.Add(new(SizeType.Percent, 50));
        previews.RowStyles.Add(new(SizeType.AutoSize)); previews.RowStyles.Add(new(SizeType.Percent, 100)); previews.RowStyles.Add(new(SizeType.AutoSize));
        previews.Controls.Add(new Label { Text = "Сейчас · первое состояние", AutoSize = true }, 0, 0);
        previews.Controls.Add(new Label { Text = "Новое оформление · первое состояние", AutoSize = true }, 1, 0);
        previews.Controls.Add(oldImage, 0, 1); previews.Controls.Add(newImage, 1, 1); previews.Controls.Add(details, 0, 2); previews.SetColumnSpan(details, 2);
        layout.Controls.Add(previews, 0, 4); layout.Controls.Add(status, 0, 5);
        var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Margin = new Padding(0, 12, 0, 0) };
        footer.Controls.Add(save); footer.Controls.Add(saveIdMap); footer.Controls.Add(loadIdMap); footer.Controls.Add(bindInOrder); layout.Controls.Add(footer, 0, 6); Controls.Add(layout);
        compare.Click += async (_, _) => await Compare(); save.Click += async (_, _) => await Save();
        saveIdMap.Click += (_, _) => SaveIdMap(); loadIdMap.Click += (_, _) => LoadIdMap();
        bindInOrder.Click += (_, _) => BindInOrder();
        baseline.TextChanged += (_, _) => InvalidatePlan(); incoming.TextChanged += (_, _) => InvalidatePlan();
        rebind.CheckedChanged += (_, _) => { if(oldBytes!=null&&newBytes!=null&&!busy){try{RebuildPlan();}catch(Exception error){InvalidatePlan();status.Text=error.Message;}}else InvalidatePlan(); };
        FormClosing += (_, e) => { if (busy) { e.Cancel = true; status.Text = "Дождитесь окончания операции."; } };
        baseline.Text = basePath ?? ""; incoming.Text = newPath ?? "";
    }

    private void AddPath(TableLayoutPanel panel, int row, string label, TextBox field, string filter)
    {
        panel.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left }, 0, row); panel.Controls.Add(field, 1, row);
        var browse = new Button { Text = "Выбрать…", AutoSize = true, AccessibleName = "Выбрать: " + label };
        browse.Click += (_, _) => { using var dialog = new OpenFileDialog { Filter = filter, CheckFileExists = true }; if (dialog.ShowDialog(this) == DialogResult.OK) field.Text = dialog.FileName; };
        panel.Controls.Add(browse, 2, row);
    }
    private void InvalidatePlan() { plan = null; oldBytes = newBytes = null; origin = null; originProfile = null; bindings.Clear(); mappingPending = false; rendering = true; try { grid.Rows.Clear(); } finally { rendering = false; } UpdateSave(); }
    private void UpdateSave()
    {
        var selected = grid.Rows.Cast<DataGridViewRow>().Where(r => r.Tag is LayoutUpdateItem { CanUpdate: true } && r.Cells[0].Value is true).Select(r => (LayoutUpdateItem)r.Tag!).ToArray();
        bool unique = selected.Select(i => i.SourceControlId).Distinct().Count() == selected.Length;
        save.Enabled = !busy && !mappingPending && plan != null && selected.Length > 0 && unique;
        saveIdMap.Enabled = save.Enabled && origin != null;
        loadIdMap.Enabled = !busy && !mappingPending && plan != null && origin != null;
        bindInOrder.Enabled = !busy && !mappingPending && plan != null && grid.SelectedRows.Cast<DataGridViewRow>().Any(r=>r.Tag is LayoutUpdateItem { Status:not "new" });
        if (!unique) status.Text = "Одна новая кнопка выбрана для нескольких старых. Уточните соответствия или снимите лишние отметки.";
    }
    private void RebuildPlan()
    {
        if (oldBytes == null || newBytes == null) return;
        var selected = grid.Rows.Cast<DataGridViewRow>().Where(r => r.Cells[0].Value is true && r.Tag is LayoutUpdateItem).Select(r => ((LayoutUpdateItem)r.Tag!).ControlId).ToHashSet();
        int? active = grid.SelectedRows.Count == 1 ? (grid.SelectedRows[0].Tag as LayoutUpdateItem)?.ControlId : null;
        plan = LayoutReconciliation.Compare(oldBytes,newBytes,rebind.Checked,bindings.Select(b => new LayoutButtonBinding(b.Key,b.Value)).ToArray());
        rendering = true;
        try
        {
            grid.Rows.Clear();
            ((DataGridViewComboBoxColumn)grid.Columns[5]).DataSource = new[] { new LayoutButtonChoice(0,"","Без связи",null) }.Concat(LayoutReconciliation.Choices(newBytes)).ToArray();
            foreach (var item in plan.Items)
            {
                int index = grid.Rows.Add(item.CanUpdate && selected.Contains(item.ControlId),item.Status switch { "matched" => "Доступно", "mapped" => "Сопоставлено", "rebind" => "Замена по ID", "new" => "Новая", "missing" => "Без связи", _ => "Конфликт" },item.Page,item.ControlId,item.Name,item.SourceControlId ?? 0);
                var row=grid.Rows[index];row.Tag=item;row.Cells[0].ReadOnly=!item.CanUpdate;row.Cells[5].ReadOnly=item.Status=="new";row.Cells[0].ToolTipText=item.Reason;
                if (!item.CanUpdate)row.DefaultCellStyle.ForeColor=SystemColors.GrayText;
                if (active==item.ControlId&&item.Status!="new")grid.CurrentCell=row.Cells[5];
            }
        }
        finally { rendering=false; }
        status.Text=$"Доступно кнопок: {plan.Items.Count(i=>i.CanUpdate)}. В столбце «Новая кнопка Figma» можно выбрать соответствие с другим ID. Отметьте нужные строки.";
        UpdateSave();Preview();
    }
    private void Busy(bool value)
    {
        busy = value; UseWaitCursor = value;
        foreach (Control control in Controls) control.Enabled = !value;
        UpdateSave();
    }
    private async Task Compare()
    {
        string basePath = baseline.Text, sourcePath = incoming.Text; bool rebindById = rebind.Checked;
        InvalidatePlan(); Busy(true); status.Text = "Читаю макеты и проверяю соответствие кнопок…";
        try
        {
            var result = await Task.Run(() =>
            {
                byte[] oldData = ReadBounded(basePath), sourceData = ReadBounded(sourcePath);
                byte[] newData = sourceData;
                FigmaOrigin? figmaOrigin = null; string? profile = null;
                if (Path.GetExtension(sourcePath).Equals(".exui", StringComparison.OrdinalIgnoreCase))
                {
                    string work = Directory.CreateTempSubdirectory("exui-layout-update-").FullName;
                    try
                    {
                        // Convert the exact snapshot selected for comparison, even if Figma exports again meanwhile.
                        string package = Path.Combine(work, "source.exui"), generated = Path.Combine(work, "incoming.gdl"); File.WriteAllBytes(package, sourceData);
                        using (var snapshot = ExuiPackage.Load(package)) { figmaOrigin = snapshot.Origin; profile = snapshot.Profile.Id; }
                        string registry = registryPath ?? new[] { Path.Combine(AppContext.BaseDirectory, "..", "samples", "donors.json"), Path.Combine(Environment.CurrentDirectory, "samples", "donors.json") }.FirstOrDefault(File.Exists)
                            ?? throw new FileNotFoundException("Для EXUI нужен samples/donors.json. Можно выбрать уже созданный новый GDL.");
                        PackageGenerator.Generate(DonorRegistry.Load(registry), package, generated, new ExtronAdapter(AdapterOptions.Default()));
                        newData = ReadBounded(generated);
                    }
                    finally { try { Directory.Delete(work, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
                }
                return (Old: oldData, New: newData, OldHash: Hash(oldData), NewHash: Hash(sourceData), Origin: figmaOrigin, Profile: profile);
            });
            oldBytes = result.Old; newBytes = result.New; oldFileHash = result.OldHash; incomingFileHash = result.NewHash; origin = result.Origin; originProfile = result.Profile;
            RebuildPlan();
        }
        catch (Exception ex) { InvalidatePlan(); status.Text = "Не удалось сравнить: " + ex.Message; }
        finally { Busy(false); }
    }
    private async Task Save()
    {
        if (plan == null || oldBytes == null || newBytes == null) return;
        int[] ids = grid.Rows.Cast<DataGridViewRow>().Where(r => r.Tag is LayoutUpdateItem { CanUpdate: true } && r.Cells[0].Value is true).Select(r => ((LayoutUpdateItem)r.Tag!).ControlId).ToArray();
        using var dialog = new SaveFileDialog { Filter = "GUI Designer (*.gdl)|*.gdl", DefaultExt = "gdl", AddExtension = true, OverwritePrompt = false,
            FileName = Path.GetFileNameWithoutExtension(baseline.Text) + "-updated.gdl", InitialDirectory = Path.GetDirectoryName(Path.GetFullPath(baseline.Text)) };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        var selection = Selection(ids);
        string basePath = baseline.Text, sourcePath = incoming.Text, destination = dialog.FileName;
        Busy(true); status.Text = "Сохраняю выбранное оформление и проверяю сохранность остального проекта…";
        try
        {
            var result = await Task.Run(() =>
            {
                if (File.Exists(destination)) throw new IOException("Такой файл уже существует. Выберите новое имя.");
                if (Hash(ReadBounded(basePath)) != oldFileHash || Hash(ReadBounded(sourcePath)) != incomingFileHash)
                    throw new InvalidDataException("Исходный файл изменился. Выполните сравнение заново.");
                var updated = LayoutReconciliation.Apply(oldBytes, newBytes, selection);
                using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write); output.Write(updated.Gdl); return updated;
            });
            status.Text = $"Сохранено: {destination}. Обновлено кнопок: {result.UpdatedIds.Length}. Далее: GUI Designer → Verify → Save and Build, затем импорт в копию GCP с сохранением конфигурации.";
        }
        catch (Exception ex) { status.Text = "Не удалось сохранить: " + ex.Message; }
        finally { Busy(false); }
    }
    private void Preview()
    {
        var item = grid.SelectedRows.Count == 1 ? grid.SelectedRows[0].Tag as LayoutUpdateItem : null;
        ShowImage(oldImage, item?.BeforePreview); ShowImage(newImage, item?.AfterPreview);
        details.Text = item == null ? "Выберите строку для сравнения." : $"{item.Reason}\nПодпись первого состояния: «{item.BeforeCaption ?? "—"}» → «{item.AfterCaption ?? "—"}». Прозрачность изображения показана на сером фоне.";
    }
    private LayoutUpdateSelection Selection(int[]? ids = null)
    {
        ids ??= grid.Rows.Cast<DataGridViewRow>().Where(r=>r.Tag is LayoutUpdateItem { CanUpdate:true }&&r.Cells[0].Value is true).Select(r=>((LayoutUpdateItem)r.Tag!).ControlId).ToArray();
        return new("exui-layout-selection/1",plan!.BaseSha256,plan.SourceSha256,ids,geometry.Checked,rebind.Checked,bindings.Where(b=>ids.Contains(b.Key)).Select(b=>new LayoutButtonBinding(b.Key,b.Value)).ToArray());
    }
    private void CheckFiles()
    {
        if(Hash(ReadBounded(baseline.Text))!=oldFileHash||Hash(ReadBounded(incoming.Text))!=incomingFileHash)throw new InvalidDataException("Исходный файл изменился. Выполните сравнение заново.");
    }
    private void SaveIdMap()
    {
        if(origin==null||originProfile==null||oldBytes==null||newBytes==null||!saveIdMap.Enabled)return;
        try
        {
            CheckFiles();var map=FigmaIdMap.Create(origin,originProfile,oldBytes,newBytes,Selection());
            string json=JsonSerializer.Serialize(map,ScreenSpecReader.Json);
            if(System.Text.Encoding.UTF8.GetByteCount(json)>128*1024)throw new InvalidDataException("Карта ID больше 128 КиБ.");
            using var dialog=new SaveFileDialog{Filter="Карта ID Figma (*.json)|*.json",DefaultExt="json",AddExtension=true,FileName="figma-id-map.json",OverwritePrompt=false};
            if(dialog.ShowDialog(this)!=DialogResult.OK)return;
            using(var output=new FileStream(dialog.FileName,FileMode.CreateNew,FileAccess.Write))output.Write(System.Text.Encoding.UTF8.GetBytes(json));
            status.Text=$"Карта для {map.Entries.Length} кнопок сохранена. Откройте её в плагине Figma → «Импортировать карту ID» → «Применить ко всем».";
        }
        catch(Exception error){status.Text="Не удалось сохранить карту ID: "+error.Message;}
    }
    private void LoadIdMap()
    {
        if(origin==null||originProfile==null||oldBytes==null||newBytes==null)return;
        using var dialog=new OpenFileDialog{Filter="Карта ID Figma (*.json)|*.json",CheckFileExists=true};if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        try
        {
            CheckFiles();using var input=File.OpenRead(dialog.FileName);if(input.Length>128*1024)throw new InvalidDataException("Карта ID больше 128 КиБ.");
            var map=JsonSerializer.Deserialize<FigmaIdMap>(input,ScreenSpecReader.Json)??throw new InvalidDataException("Пустая карта ID.");
            var proposed=map.BindTo(origin,originProfile);LayoutReconciliation.Compare(oldBytes,newBytes,rebind.Checked,proposed);
            bindings.Clear();foreach(var pair in proposed)bindings.Add(pair.ControlId,pair.SourceControlId);RebuildPlan();
            var ids=proposed.Select(p=>p.ControlId).ToHashSet();rendering=true;
            try{foreach(DataGridViewRow row in grid.Rows)row.Cells[0].Value=row.Tag is LayoutUpdateItem { CanUpdate:true,Status:not "new" } item&&ids.Contains(item.ControlId);}
            finally{rendering=false;}
            UpdateSave();status.Text="Соответствия загружены по исходным слоям. Проверьте выбранные кнопки перед сохранением.";
        }
        catch(Exception error){status.Text="Не удалось загрузить соответствия: "+error.Message;}
    }
    private void BindInOrder()
    {
        if(newBytes==null)return;
        var targets=grid.SelectedRows.Cast<DataGridViewRow>().Where(r=>r.Tag is LayoutUpdateItem {Status:not "new"}).OrderBy(r=>r.Index).Select(r=>(LayoutUpdateItem)r.Tag!).ToArray();
        if(targets.Length==0)return;
        using var dialog=new Form{Text="Связать кнопки по порядку",Size=new Size(850,520),StartPosition=FormStartPosition.CenterParent,Font=Font,MinimizeBox=false,MaximizeBox=false};
        var layout=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(12),ColumnCount=1,RowCount=3};layout.RowStyles.Add(new(SizeType.AutoSize));layout.RowStyles.Add(new(SizeType.Percent,100));layout.RowStyles.Add(new(SizeType.AutoSize));
        var hint=new Label{AutoSize=true,Dock=DockStyle.Fill,Text=$"Выделено старых кнопок: {targets.Length}. Выберите столько же новых (Ctrl/Shift). Порядок — сверху вниз в списке. После связывания проверьте пары в основной таблице.\nСтарые: {string.Join(", ",targets.Take(8).Select(t=>t.Name))}{(targets.Length>8?"…":"")}"};layout.Controls.Add(hint,0,0);
        var list=new ListBox{Dock=DockStyle.Fill,SelectionMode=SelectionMode.MultiExtended,DisplayMember=nameof(LayoutButtonChoice.Label),DataSource=LayoutReconciliation.Choices(newBytes)};layout.Controls.Add(list,0,1);
        var footer=new FlowLayoutPanel{Dock=DockStyle.Fill,AutoSize=true,FlowDirection=FlowDirection.RightToLeft};var ok=new Button{Text="Связать",AutoSize=true,Enabled=false,DialogResult=DialogResult.OK};var cancel=new Button{Text="Отмена",AutoSize=true,DialogResult=DialogResult.Cancel};footer.Controls.Add(ok);footer.Controls.Add(cancel);layout.Controls.Add(footer,0,2);dialog.Controls.Add(layout);dialog.AcceptButton=ok;dialog.CancelButton=cancel;
        list.SelectedIndexChanged+=(_,_)=>ok.Enabled=list.SelectedItems.Count==targets.Length;
        if(dialog.ShowDialog(this)!=DialogResult.OK)return;
        var sources=list.SelectedItems.Cast<LayoutButtonChoice>().ToArray();if(sources.Length!=targets.Length)return;
        for(int i=0;i<targets.Length;i++)bindings[targets[i].ControlId]=sources[i].ControlId;
        RebuildPlan();var ids=targets.Select(t=>t.ControlId).ToHashSet();rendering=true;
        try{foreach(DataGridViewRow row in grid.Rows)if(row.Tag is LayoutUpdateItem {CanUpdate:true,Status:not "new"} item&&ids.Contains(item.ControlId))row.Cells[0].Value=true;}
        finally{rendering=false;}
        UpdateSave();status.Text="Группа связана по порядку списка. Проверьте выбранные пары и превью перед сохранением GDL или карты ID.";
    }
    private static void ShowImage(PictureBox box, string? encoded)
    {
        var old = box.Image; box.Image = null; old?.Dispose();
        if (encoded == null) return;
        try { using var stream = new MemoryStream(Convert.FromBase64String(encoded)); using var image = Image.FromStream(stream); box.Image = new Bitmap(image); }
        catch (ArgumentException) { } // Native/no bitmap appearance is still described by the captions.
    }
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
    private static byte[] ReadBounded(string path)
    {
        using var file = File.OpenRead(path); if (file.Length > ExtronContainer.MaxFileBytes) throw new InvalidDataException("Файл превышает 64 МиБ.");
        byte[] bytes = new byte[checked((int)file.Length)]; file.ReadExactly(bytes); return bytes;
    }
    protected override void Dispose(bool disposing)
    { if (disposing) { oldImage.Image?.Dispose(); newImage.Image?.Dispose(); } base.Dispose(disposing); }
}
