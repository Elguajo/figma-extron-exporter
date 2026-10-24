using ExtronExporter.Adapter;

static class StabilityTests
{
    static void Check(bool valid, string why = "Assertion failed") { if (!valid) throw new Exception(why); }

    public static void Unit(Action<string, Action> test)
    {
        test("Host timeout: unset keeps 10 minutes, whole minutes are accepted", () =>
        {
            Check(AdapterOptions.HostTimeout(null) == TimeSpan.FromMinutes(10) && AdapterOptions.HostTimeout("") == TimeSpan.FromMinutes(10));
            Check(AdapterOptions.HostTimeout("3") == TimeSpan.FromMinutes(3) && AdapterOptions.HostTimeout("1440") == TimeSpan.FromMinutes(1440));
        });
        test("Stale temp: removes only this tool's work folders older than two days", () =>
        {
            string root = Directory.CreateTempSubdirectory("exui-stale-test-").FullName;
            try
            {
                var now = DateTime.UtcNow;
                string Make(string relative, TimeSpan age)
                {
                    string path = Path.Combine(root, relative); Directory.CreateDirectory(path); File.WriteAllText(Path.Combine(path, "x"), "x");
                    Directory.SetLastWriteTimeUtc(path, now - age); return path;
                }
                string guid = Guid.NewGuid().ToString("N");
                string oldPackage = Make("exui-package-old", TimeSpan.FromDays(3)), freshPackage = Make("exui-package-new", TimeSpan.FromHours(30));
                string oldAdapter = Make(Path.Combine("extron-adapter", guid), TimeSpan.FromDays(3)), foreign = Make(Path.Combine("extron-adapter", "keep-me"), TimeSpan.FromDays(9));
                string unrelated = Make("other-tool", TimeSpan.FromDays(9));
                Check(StaleTemp.Sweep(root, now) == 2);
                Check(!Directory.Exists(oldPackage) && !Directory.Exists(oldAdapter));
                Check(Directory.Exists(freshPackage) && Directory.Exists(foreign) && Directory.Exists(unrelated));
                Check(StaleTemp.Sweep(Path.Combine(root, "missing"), now) == 0);
            }
            finally { Directory.Delete(root, true); }
        });
        foreach (string value in new[] { "0", "-1", "1441", "1.5", " 5", "five" })
            test($"Host timeout: reject '{value}'", () =>
            {
                try { AdapterOptions.HostTimeout(value); }
                catch (AdapterException e) when (e.Code == "host-timeout") { return; }
                throw new Exception("Expected AdapterException host-timeout");
            });
    }
}
