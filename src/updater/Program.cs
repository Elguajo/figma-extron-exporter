namespace ExtronExporter.Updater;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            if (args.Length == 1 && args[0] == "--register-exui") { ExuiAssociation.Register(); return 0; }
            if (args.Length == 1 && args[0] == "--unregister-exui") { ExuiAssociation.Unregister(); return 0; }
            if (args.Length is 1 or 2 && args[0] == "--convert")
            {
                Application.Run(new ConversionForm(args.ElementAtOrDefault(1)));
                return 0;
            }
        }
        catch (Exception e)
        {
            MessageBox.Show(e.Message, "Figma → Extron", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        Application.Run(new LayoutUpdateForm(args.ElementAtOrDefault(0), args.ElementAtOrDefault(1), args.ElementAtOrDefault(2)));
        return 0;
    }
}
