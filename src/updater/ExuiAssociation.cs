using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace ExtronExporter.Updater;

internal static class ExuiAssociation
{
    internal const string ProgId = "FigmaExtron.Exui";
    private const string Classes = @"Software\Classes\";
    private static string Command => $"\"{Application.ExecutablePath}\" --convert \"%1\"";

    public static void Register()
    {
        using var existingExtension = Registry.ClassesRoot.OpenSubKey(".exui");
        string? existingHandler = existingExtension?.GetValue("") as string;
        using (var type = Registry.CurrentUser.CreateSubKey(Classes + ProgId))
        {
            type.SetValue("", "Figma → Extron Exporter — EXUI");
            using var icon = type.CreateSubKey("DefaultIcon");
            icon.SetValue("", $"\"{Application.ExecutablePath}\",0");
            using var command = type.CreateSubKey(@"shell\open\command");
            command.SetValue("", Command);
        }
        using (var extension = Registry.CurrentUser.CreateSubKey(Classes + ".exui"))
        {
            // Preserve an existing handler and Windows' protected UserChoice.
            if (string.IsNullOrEmpty(existingHandler)) extension.SetValue("", ProgId);
            using var openWith = extension.CreateSubKey("OpenWithProgids");
            openWith.SetValue(ProgId, "");
        }
        SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero); // SHCNE_ASSOCCHANGED
    }

    public static void Unregister()
    {
        // An older copy must not remove the registration of a newer installation.
        using (var command = Registry.CurrentUser.OpenSubKey(Classes + ProgId + @"\shell\open\command"))
            if (!string.Equals(command?.GetValue("") as string, Command, StringComparison.OrdinalIgnoreCase)) return;
        using (var extension = Registry.CurrentUser.OpenSubKey(Classes + ".exui", writable: true))
        {
            if (extension?.GetValue("") as string == ProgId) extension.DeleteValue("", false);
            using var openWith = extension?.OpenSubKey("OpenWithProgids", writable: true);
            openWith?.DeleteValue(ProgId, false);
        }
        Registry.CurrentUser.DeleteSubKeyTree(Classes + ProgId, throwOnMissingSubKey: false);
        SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
    }

    [DllImport("shell32.dll")]
    private static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
}
