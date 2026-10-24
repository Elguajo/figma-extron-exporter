namespace ExtronExporter.Updater;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LayoutUpdateForm(args.ElementAtOrDefault(0), args.ElementAtOrDefault(1), args.ElementAtOrDefault(2)));
    }
}
