using System.Diagnostics;
using ExtronExporter.Adapter;
using ExtronExporter.Screen;

namespace ExtronExporter.Updater;

internal sealed class ConversionForm : Form
{
    private readonly Label status = new() { Text = "Выберите EXUI — конвертация начнётся автоматически.", AutoSize = true, Dock = DockStyle.Fill, AccessibleRole = AccessibleRole.StaticText };
    private readonly TextBox details = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Dock = DockStyle.Fill, AccessibleName = "Результат конвертации" };
    private readonly Button choose = new() { Text = "Выбрать EXUI…", AutoSize = true };
    private readonly Button open = new() { Text = "Открыть GDL", AutoSize = true, Enabled = false };
    private readonly Button folder = new() { Text = "Показать файл", AutoSize = true, Enabled = false };
    private readonly Button associate = new() { Text = "Открывать .exui этой утилитой", AutoSize = true };
    private readonly ProgressBar progress = new() { Dock = DockStyle.Fill, Height = 5, Style = ProgressBarStyle.Blocks, AccessibleName = "Ход конвертации" };
    private bool busy;
    private string? output;
    private string? designer;

    public ConversionForm(string? initialPackage)
    {
        Text = "Figma → Extron — конвертер EXUI · " + typeof(ConversionForm).Assembly.GetName().Version?.ToString(3);
        Font = new Font("Segoe UI", 10); AutoScaleMode = AutoScaleMode.Dpi;
        MinimumSize = new Size(640, 380); Size = new Size(820, 480); StartPosition = FormStartPosition.CenterScreen;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(20), ColumnCount = 1, RowCount = 6 };
        layout.ColumnStyles.Add(new(SizeType.Percent, 100));
        foreach (var style in new[] { new RowStyle(SizeType.AutoSize), new RowStyle(SizeType.AutoSize), new RowStyle(SizeType.AutoSize), new RowStyle(SizeType.Percent, 100), new RowStyle(SizeType.AutoSize), new RowStyle(SizeType.AutoSize) })
            layout.RowStyles.Add(style);
        layout.Controls.Add(new Label { Text = "EXUI → проект GUI Designer", Font = new Font(Font, FontStyle.Bold), AutoSize = true, Margin = new Padding(0, 0, 0, 12) }, 0, 0);
        layout.Controls.Add(status, 0, 1);
        layout.Controls.Add(progress, 0, 2);
        layout.Controls.Add(details, 0, 3);
        var actions = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, Margin = new Padding(0, 12, 0, 4) };
        actions.Controls.AddRange([choose, open, folder]); layout.Controls.Add(actions, 0, 4);
        var registration = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill };
        registration.Controls.Add(associate); layout.Controls.Add(registration, 0, 5);
        Controls.Add(layout); AcceptButton = choose;
        choose.Click += async (_, _) =>
        {
            using var dialog = new OpenFileDialog { Filter = "Экспорт Figma (*.exui)|*.exui", Title = "Выберите EXUI для конвертации", CheckFileExists = true };
            if (dialog.ShowDialog(this) == DialogResult.OK) await Convert(dialog.FileName);
        };
        open.Click += (_, _) => TryOpen();
        folder.Click += (_, _) =>
        {
            try
            {
                var start = new ProcessStartInfo("explorer.exe") { UseShellExecute = true };
                start.Arguments = $"/select,\"{output}\"";
                Process.Start(start)?.Dispose();
            }
            catch (Exception e) { MessageBox.Show(this, e.Message, "Не удалось открыть папку", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        };
        associate.Click += (_, _) =>
        {
            try
            {
                ExuiAssociation.Register();
                MessageBox.Show(this, "Утилита добавлена для .exui. Откройте EXUI двойным щелчком. Если Windows уже выбрала другое приложение, укажите эту утилиту через «Открыть с помощью» → «Всегда».", "Открытие EXUI", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception e) { MessageBox.Show(this, e.Message, "Не удалось настроить открытие EXUI", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        };
        FormClosing += (_, e) => { if (busy) { e.Cancel = true; status.Text = "Дождитесь завершения конвертации. Окно можно закрыть после сохранения результата."; } };
        Shown += async (_, _) => { if (initialPackage != null) await Convert(initialPackage); };
    }

    private async Task Convert(string package)
    {
        if (busy) return;
        busy = true; choose.Enabled = associate.Enabled = open.Enabled = folder.Enabled = false;
        output = designer = null; details.Text = "Исходный EXUI: " + package;
        status.Text = "Создаём GDL и проверяем результат…";
        progress.Style = ProgressBarStyle.Marquee;
        try
        {
            var result = await Task.Run(() =>
            {
                string destination = ConversionFiles.NextOutput(package);
                string registry = ConversionFiles.Registry(AppContext.BaseDirectory, Environment.GetEnvironmentVariable("EXUI_DONOR_REGISTRY"));
                var adapter = new ExtronAdapter(AdapterOptions.Default());
                StaleTemp.Sweep(Path.GetTempPath(), DateTime.UtcNow);
                var report = PackageGenerator.Generate(DonorRegistry.Load(registry), package, destination, adapter);
                return (report, executable: Path.Combine(adapter.Options.InstallDir, "GUI Designer.exe"));
            });
            output = result.report.Generation.Output; designer = result.executable;
            status.Text = "Готово. GDL сохранён рядом с EXUI.";
            details.Text = $"Проект: {output}\r\n\r\nОтчёт: {output}.report.json\r\n\r\nПанель: {result.report.Generation.Panel}\r\nФормат: {result.report.Contract}\r\nПроверки: {result.report.Generation.Checks.Count(c => c.Passed)}/{result.report.Generation.Checks.Count}\r\n\r\nВ GUI Designer выполните Verify → Save and Build.";
            open.Enabled = folder.Enabled = true;
            TryOpen();
        }
        catch (Exception e)
        {
            status.Text = "Не удалось создать GDL.";
            string message = Explain(e);
            details.Text = "Исходный EXUI: " + package + "\r\n\r\n" + message;
            string? code = e switch { AdapterException a => a.Code, ExuiException p => p.Code, _ => null };
            if (code != null) details.AppendText("\r\n\r\nКод ошибки: " + code);
            if (message != e.Message) details.AppendText("\r\n" + e.Message);
        }
        finally
        {
            busy = false; choose.Enabled = associate.Enabled = true;
            progress.Style = ProgressBarStyle.Blocks;
        }
    }

    private void TryOpen()
    {
        if (output == null || designer == null) return;
        try
        {
            var start = new ProcessStartInfo(designer) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(designer)! };
            start.ArgumentList.Add(output);
            Process.Start(start)?.Dispose();
        }
        catch (Exception e)
        {
            status.Text = "GDL сохранён. Откройте его в GUI Designer вручную.";
            details.AppendText("\r\n\r\nНе удалось запустить GUI Designer: " + e.Message);
        }
    }

    private static string Explain(Exception error) => error switch
    {
        AdapterException { Code: "donor-missing" or "registry-missing" } => "Не найден технический шаблон. Проверьте samples/donors рядом с реестром конвертера.",
        AdapterException { Code: "extron-missing" } => "Не найден GUI Designer. Установите его или задайте EXTRON_GUI_DESIGNER_DIR.",
        AdapterException { Code: "extron-version" or "donor-version" } => "Версии GUI Designer и комплекта конвертера несовместимы. Используйте проверенный совместимый комплект.",
        AdapterException { Code: "output-exists" } => "Это имя GDL уже занято другим запуском. Повторно выберите EXUI для создания следующей версии.",
        ExuiException { Code: "package-schema" } => "Версия EXUI не поддерживается. Повторите экспорт из актуального совместимого плагина Figma.",
        UnauthorizedAccessException => "Нет доступа к папке EXUI. Переместите EXUI в папку, где можно создавать файлы.",
        _ => error.Message
    };
}
