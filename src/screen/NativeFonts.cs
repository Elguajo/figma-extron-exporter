namespace ExtronExporter.Screen;

// Pinned static Inter 4.1 collection, distributed under its SIL OFL license.
// No font binaries or local paths are accepted from an untrusted EXUI package.
public static class NativeFonts
{
    public const string InterResource = "Inter Regular Bold Italic";
    public const string InterSha256 = "EA4E3D9970B9B6B566110A1B0E13635FE235280B83DD2443DCB3FACA1E2456EF";
    public static PlanFont Resolve(FontSpec font)
    {
        if (font.Family is not ("Inter" or "Inter Display") && font.Style == null) return new(font.Family, font.Size, font.Bold);
        if (font.Family is not ("Inter" or "Inter Display")) throw new ArgumentException("Native fonts: Arial, Inter, Inter Display.");
        string style = font.Style ?? (font.Bold == true ? "Bold" : "Regular");
        bool italic = style.EndsWith("Italic", StringComparison.Ordinal);
        string weight = italic ? style[..^6].TrimEnd() : style;
        if (weight == "") weight = "Regular";
        string? suffix = weight switch { "Regular" or "Bold" => "", "Thin" => " Thin", "Extra Light" => " ExtraLight", "Light" => " Light", "Medium" => " Medium", "Semi Bold" => " SemiBold", "Extra Bold" => " ExtraBold", "Black" => " Black", _ => null };
        if (suffix == null || font.Bold != (weight == "Bold")) throw new ArgumentException("Inter style and bold flag disagree or the style is unsupported.");
        return new(font.Family + suffix, font.Size, font.Bold, italic, InterResource);
    }
}
