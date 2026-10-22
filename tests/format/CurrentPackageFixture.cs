using System.Text;
using System.Text.RegularExpressions;

// Reuse the original authored artwork/IDs as test data, always under the current contract.
// This is a test fixture builder, not a compatibility path in the package reader.
static class CurrentPackageFixture
{
    public static Dictionary<string, byte[]> Read(string directory)
    {
        var files = Directory.GetFiles(directory, "*", SearchOption.AllDirectories)
            .ToDictionary(f => Path.GetRelativePath(directory, f).Replace('\\', '/'), File.ReadAllBytes);
        foreach (string name in new[] { "manifest.json", "screen.json" })
            files[name] = Encoding.UTF8.GetBytes(Regex.Replace(Encoding.UTF8.GetString(files[name]),
                "\"(exui|exui-screen)/[1-4]\"", "\"$1/5\""));
        return files;
    }
}
