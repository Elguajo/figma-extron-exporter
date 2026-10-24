using System.Text.RegularExpressions;

namespace ExtronExporter.Adapter;

/// <summary>
/// Removes work folders that an interrupted run (Ctrl+C, a killed process) left in the temporary
/// folder. Only this tool's own names are touched; adapter folders hold a copy of the donor.
/// </summary>
public static class StaleTemp
{
    /// <summary>Longer than the 24-hour maximum EXUI_HOST_TIMEOUT, so a running conversion is never touched.</summary>
    public static readonly TimeSpan Age = TimeSpan.FromDays(2);

    public static int Sweep(string tempRoot, DateTime nowUtc)
    {
        var candidates = new List<string>();
        try
        {
            if (!Directory.Exists(tempRoot)) return 0;
            candidates.AddRange(Directory.EnumerateDirectories(tempRoot, "exui-package-*"));
            string adapter = Path.Combine(tempRoot, "extron-adapter");
            if (Directory.Exists(adapter))
                candidates.AddRange(Directory.EnumerateDirectories(adapter).Where(d => Regex.IsMatch(Path.GetFileName(d), @"\A[0-9a-f]{32}\z")));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return 0; }
        int removed = 0;
        foreach (string directory in candidates)
        {
            // Best effort: cleanup must never fail or delay the command that triggered it.
            try { if (nowUtc - Directory.GetLastWriteTimeUtc(directory) > Age) { Directory.Delete(directory, true); removed++; } }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
        }
        return removed;
    }
}
