namespace ExtronExporter.Updater;

/// <summary>File selection for the desktop converter; never depends on the caller's working directory.</summary>
internal static class ConversionFiles
{
    public static string NextOutput(string packagePath)
    {
        string full = Path.GetFullPath(packagePath);
        if (!Path.GetExtension(full).Equals(".exui", StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Выберите файл .exui, экспортированный из Figma.");
        if (!File.Exists(full)) throw new FileNotFoundException("Файл EXUI не найден.", full);
        string stem = Path.Combine(Path.GetDirectoryName(full)!, Path.GetFileNameWithoutExtension(full));
        for (int version = 1; version < int.MaxValue; version++)
        {
            string output = stem + (version == 1 ? "" : $"-v{version}") + ".gdl";
            if (!Path.Exists(output) && !Path.Exists(output + ".report.json")) return output;
        }
        throw new IOException("Не удалось подобрать свободное имя GDL.");
    }

    public static string Registry(string applicationDirectory, string? explicitPath)
    {
        // An explicit override must never silently fall back to a different registry.
        if (!string.IsNullOrWhiteSpace(explicitPath)) return Path.GetFullPath(explicitPath);
        for (DirectoryInfo? dir = new(Path.GetFullPath(applicationDirectory)); dir != null; dir = dir.Parent)
        {
            string path = Path.Combine(dir.FullName, "samples", "donors.json");
            if (File.Exists(path)) return path;
        }
        throw new FileNotFoundException("Не найден samples/donors.json. Сохраните утилиту внутри комплекта конвертера или папки проекта.");
    }
}
