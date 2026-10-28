using ExtronExporter.Updater;

static class ConversionTests
{
    private static void Check(bool value) { if (!value) throw new Exception("Assertion failed"); }

    public static void Unit(Action<string, Action> test)
    {
        test("Desktop conversion: next output preserves GDL, reports and directories, including Unicode paths", () =>
        {
            string dir = Directory.CreateTempSubdirectory("exui-конвертер-").FullName;
            try
            {
                string package = Path.Combine(dir, "Проект панели.exui");
                File.WriteAllText(package, "input");
                string first = Path.ChangeExtension(package, ".gdl");
                Check(ConversionFiles.NextOutput(package) == first);
                File.WriteAllText(first, "existing project");
                File.WriteAllText(Path.Combine(dir, "Проект панели-v2.gdl.report.json"), "existing report");
                Directory.CreateDirectory(Path.Combine(dir, "Проект панели-v3.gdl"));
                Check(ConversionFiles.NextOutput(package) == Path.Combine(dir, "Проект панели-v4.gdl"));
                Check(File.ReadAllText(first) == "existing project" && File.ReadAllText(package) == "input");
            }
            finally { Directory.Delete(dir, true); }
        });
        test("Desktop conversion: rejects wrong extension and missing input before choosing output", () =>
        {
            try { ConversionFiles.NextOutput("input.gdl"); throw new Exception("Accepted GDL"); }
            catch (InvalidDataException) { }
            try { ConversionFiles.NextOutput(Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".exui")); throw new Exception("Accepted missing file"); }
            catch (FileNotFoundException) { }
        });
        test("Desktop conversion: registry comes from the application tree and explicit overrides never fall back", () =>
        {
            string dir = Directory.CreateTempSubdirectory("exui-registry-").FullName;
            try
            {
                Directory.CreateDirectory(Path.Combine(dir, "samples"));
                string registry = Path.Combine(dir, "samples", "donors.json");
                File.WriteAllText(registry, "{}");
                string app = Path.Combine(dir, "updater", "bin"); Directory.CreateDirectory(app);
                Check(ConversionFiles.Registry(app, null) == registry);
                string missing = Path.Combine(dir, "custom.json");
                Check(ConversionFiles.Registry(app, missing) == missing);
                File.Delete(registry);
                try { ConversionFiles.Registry(app, null); throw new Exception("Accepted missing registry"); }
                catch (FileNotFoundException) { }
            }
            finally { Directory.Delete(dir, true); }
        });
    }
}
