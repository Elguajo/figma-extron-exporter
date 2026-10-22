using System.Security.Cryptography;
using ExtronExporter.Screen;

namespace ExtronExporter.Adapter;

internal static class EmbeddedFonts
{
    public static object[] For(GeneratePlan plan)
    {
        if(!plan.Containers.SelectMany(c=>c.Elements).Any(e=>e.Font?.Resource==NativeFonts.InterResource))return [];
        using var stream=typeof(EmbeddedFonts).Assembly.GetManifestResourceStream("fonts/Inter.ttc")??throw new AdapterException("font-missing","Bundled Inter collection is missing; reinstall the CLI.");
        using var memory=new MemoryStream();stream.CopyTo(memory);byte[] data=memory.ToArray();
        if(Convert.ToHexString(SHA256.HashData(data))!=NativeFonts.InterSha256)throw new AdapterException("font-hash","Bundled Inter font hash differs from the pinned release.");
        return [new {resourceName=NativeFonts.InterResource,sha256=NativeFonts.InterSha256,data=Convert.ToBase64String(data)}];
    }
}
