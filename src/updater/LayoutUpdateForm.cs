using System.Security.Cryptography;
using ExtronExporter.Adapter;
using ExtronExporter.Format;

namespace ExtronExporter.Updater;

internal sealed class LayoutUpdateForm : Form
{
    private readonly TextBox baseline = new() { Dock = DockStyle.Fill, AccessibleName = "Рабочий GDL" };
    private readonly TextBox incoming = new() { Dock = DockStyle.Fill, AccessibleName = "Новое оформление EXUI или GDL" };
    private readonly Button compare = new() { Text = "Сравнить", AutoSize = true };
    private readonly Button save = new() { Text = "Сохранить выбранные изменения…", AutoSize = true, Enabled = false };
    private readonly CheckBox geometry = new() { Text = "Перенести также положение и размеры выбранных кнопок", AutoSize = true };
    private readonly Label status = new() { Text = "Выберите рабочий GDL и новый экспорт Figma. Исходные файлы сохраняются.", Dock = DockStyle.Fill, AutoSize = true, AccessibleRole = AccessibleRole.StaticText };
    private readonly Label details = new() { Dock = DockStyle.Fill, AutoSize = true };
    private readonly DataGridView grid = new() { Dock = DockStyle.Fill, AllowUserToAddRows = false, AllowUserToDeleteRows = false,
        MultiSelect = false, SelectionMode = DataGridViewSelectionMode.FullRowSelect, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
        RowHeadersVisible = false, AccessibleName = "Выбор кнопок для обновления" };
    private readonly PictureBox oldImage = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.FromArgb(225, 225, 225), AccessibleName = "Оформление до обновления" };
    private readonly PictureBox newImage = new() { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.FromArgb(225, 225, 225), AccessibleName = "Новое оформление" };
    private readonly string? registryPath;
    private bool busy;
    private LayoutUpdatePlan? plan;
    private byte[]? oldBytes, newBytes;
    private string? oldFileHash, incomingFileHash;

    public LayoutUpdateForm(string? basePath, string? newPath, string? registry)
    {
        Text = "Figma → Extron — обновление оформления GDL";
        MinimumSize = new Size(900, 680); Size = new Size(1160, 820); StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10); AutoScaleMode = AutoScaleMode.Dpi;
        registryPath = registry;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(18), ColumnCount = 1, RowCount = 7 };
        layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.AutoSize));
        layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.Percent, 60));
        layout.RowStyles.Add(new(SizeType.Percent, 40)); layout.RowStyles.Add(new(SizeType.AutoSize)); layout.RowStyles.Add(new(SizeType.AutoSize));
        layout.Controls.Add(new Label { Text = "Обновить выбранные кнопки", AutoSize = true, Font = new Font(Font, FontStyle.Bold), Margin = new Padding(0, 0, 0, 12) }, 0, 0);
        var paths = new TableLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, ColumnCount = 3, RowCount = 2 };
        paths.ColumnStyles.Add(new(SizeType.Absolute, 180)); paths.ColumnStyles.Add(new(SizeType.Percent, 100)); paths.ColumnStyles.Add(new(SizeType.AutoSize));
        AddPath(paths, 0, "Рабочий GDL", baseline, "GUI Designer (*.gdl)|*.gdl");
        AddPath(paths, 1, "Новое оформление", incoming, "Экспорт Figma / GUI Designer|*.exui;*.gdl"); layout.Controls.Add(paths, 0, 1);
        var actions = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, Margin = new Padding(0, 10, 0, 10) };
        actions.Controls.Add(compare); actions.Controls.Add(geometry); layout.Controls.Add(actions, 0, 2);
        grid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "apply", HeaderText = "Обновить", FillWeight = 55 });
        foreach (var (name, title, width) in new[] { ("state", "Статус", 90), ("page", "Страница", 110), ("id", "ID", 55), ("old", "Сейчас", 140), ("new", "Новый макет", 140) })
            grid.Columns.Add(new DataGridViewTextBoxColumn { Name = name, HeaderText = title, ReadOnly = true, FillWeight = width });
        grid.CellBeginEdit += (_, e) => { if (grid.Rows[e.RowIndex].Tag is not LayoutUpdateItem { CanUpdate: true }) e.Cancel = true; };
        grid.CurrentCellDirtyStateChanged += (_, _) => { if (grid.IsCurrentCellDirty) grid.CommitEdit(DataGridViewDataErrorContexts.Commit); };
        grid.CellValueChanged += (_, _) => UpdateSave(); grid.SelectionChanged += (_, _) => Preview();
        layout.Controls.Add(grid, 0, 3);
        var previews = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 3, Margin = new Padding(0, 12, 0, 12) };
        previews.ColumnStyles.Add(new(SizeType.Percent, 50)); previews.ColumnStyles.Add(new(SizeType.Percent, 50));
        previews.RowStyles.Add(new(SizeType.AutoSize)); previews.RowStyles.Add(new(SizeType.Percent, 100)); previews.RowStyles.Add(new(SizeType.AutoSize));
        previews.Controls.Add(new Label { Text = "Сейчас · первое состояние", AutoSize = true }, 0, 0);
        previews.Controls.Add(new Label { Text = "Новое оформление · первое состояние", AutoSize = true }, 1, 0);
        previews.Controls.Add(oldImage, 0, 1); previews.Controls.Add(newImage, 1, 1); previews.Controls.Add(details, 0, 2); previews.SetColumnSpan(details, 2);
        layout.Controls.Add(previews, 0, 4); layout.Controls.Add(status, 0, 5);
        var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Margin = new Padding(0, 12, 0, 0) };
        footer.Controls.Add(save); layout.Controls.Add(footer, 0, 6); Controls.Add(layout);
        compare.Click += async (_, _) => await Compare(); save.Click += async (_, _) => await Save();
        baseline.TextChanged += (_, _) => InvalidatePlan(); incoming.TextChanged += (_, _) => InvalidatePlan();
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
    private void InvalidatePlan() { plan = null; oldBytes = newBytes = null; grid.Rows.Clear(); UpdateSave(); }
    private void UpdateSave() => save.Enabled = !busy && plan != null && grid.Rows.Cast<DataGridViewRow>().Any(r => r.Tag is LayoutUpdateItem { CanUpdate: true } && r.Cells[0].Value is true);
    private void Busy(bool value)
    {
        busy = value; UseWaitCursor = value;
        foreach (Control control in Controls) control.Enabled = !value;
        UpdateSave();
    }
    private async Task Compare()
    {
        string basePath = baseline.Text, sourcePath = incoming.Text;
        InvalidatePlan(); Busy(true); status.Text = "Читаю макеты и проверяю соответствие кнопок…";
        try
        {
            var result = await Task.Run(() =>
            {
                byte[] oldData = ReadBounded(basePath), sourceData = ReadBounded(sourcePath);
                byte[] newData = sourceData;
                if (Path.GetExtension(sourcePath).Equals(".exui", StringComparison.OrdinalIgnoreCase))
                {
                    string work = Directory.CreateTempSubdirectory("exui-layout-update-").FullName;
                    try
                    {
                        // Convert the exact snapshot selected for comparison, even if Figma exports again meanwhile.
                        string package = Path.Combine(work, "source.exui"), generated = Path.Combine(work, "incoming.gdl"); File.WriteAllBytes(package, sourceData);
                        string registry = registryPath ?? new[] { Path.Combine(AppContext.BaseDirectory, "..", "samples", "donors.json"), Path.Combine(Environment.CurrentDirectory, "samples", "donors.json") }.FirstOrDefault(File.Exists)
                            ?? throw new FileNotFoundException("Для EXUI нужен samples/donors.json. Можно выбрать уже созданный новый GDL.");
                        PackageGenerator.Generate(DonorRegistry.Load(registry, DonorLibrary.Locate(null)), package, generated, new ExtronAdapter(AdapterOptions.Default()));
                        newData = ReadBounded(generated);
                    }
                    finally { try { Directory.Delete(work, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
                }
                return (Old: oldData, New: newData, OldHash: Hash(oldData), NewHash: Hash(sourceData), Plan: LayoutReconciliation.Compare(oldData, newData));
            });
            oldBytes = result.Old; newBytes = result.New; oldFileHash = result.OldHash; incomingFileHash = result.NewHash; plan = result.Plan;
            foreach (var item in plan.Items)
            {
                int index = grid.Rows.Add(false, item.Status switch { "matched" => "Доступно", "new" => "Новая", "missing" => "Нет в новом", _ => "Конфликт" }, item.Page, item.ControlId, item.Name, item.IncomingName ?? "—");
                var row = grid.Rows[index]; row.Tag = item; row.Cells[0].ReadOnly = !item.CanUpdate;
                if (!item.CanUpdate) row.DefaultCellStyle.ForeColor = SystemColors.GrayText;
                row.Cells[0].ToolTipText = item.Reason;
            }
            status.Text = $"Доступно кнопок: {plan.Items.Count(i => i.CanUpdate)}. Отметьте нужные. Остальные элементы, страницы и popup сохранятся. Назначения GCP проверяются после импорта.";
            Preview();
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
        var selection = new LayoutUpdateSelection("exui-layout-selection/1", plan.BaseSha256, plan.SourceSha256, ids, geometry.Checked);
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
