using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ExtronExporter.Screen;

// Evaluates ONLY the keywords in our two embedded, trusted schemas. Never loads a package-supplied
// schema or remote reference. This is not a general-purpose JSON Schema implementation.
internal static class ContractJson
{
    // JSON Schema integer includes 1.0 and 1e0. Canonicalize them before the existing typed model,
    // whose System.Text.Json integer converters otherwise require an integer token spelling.
    public static JsonNode? LowerNumbers(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => new JsonObject(value.EnumerateObject().Select(p => new KeyValuePair<string, JsonNode?>(p.Name, LowerNumbers(p.Value)))),
        JsonValueKind.Array => new JsonArray(value.EnumerateArray().Select(LowerNumbers).ToArray()),
        JsonValueKind.Number when TryInteger(value, out int n) => JsonValue.Create(n),
        _ => JsonNode.Parse(value.GetRawText())
    };

    private static bool TryInteger(JsonElement value, out int result)
    {
        result = 0;
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetDecimal(out decimal n) ||
            n != decimal.Truncate(n) || n < int.MinValue || n > int.MaxValue) return false;
        result = (int)n;
        // Decimal parsing may round a very long fraction. IDs must compare numerically equal to
        // the integer token, rather than silently adopting that rounded value.
        return JsonElement.DeepEquals(value, JsonSerializer.SerializeToElement(result));
    }
    public static JsonElement Read(byte[] bytes, string name)
    {
        try
        {
            using var doc = JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 32 });
            Unique(doc.RootElement, name);
            return doc.RootElement.Clone();
        }
        catch (JsonException e) { throw new ExuiException("package-json", $"{name}: {e.Message}"); }
    }

    private static void Unique(JsonElement value, string at)
    {
        if (value.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var p in value.EnumerateObject())
            {
                if (!names.Add(p.Name)) throw new ExuiException("package-json", $"{at}.{p.Name}: duplicate JSON property.");
                Unique(p.Value, at + "." + p.Name);
            }
        }
        else if (value.ValueKind == JsonValueKind.Array)
            foreach (var item in value.EnumerateArray()) Unique(item, at + "[]");
    }

    public static void Validate(JsonElement value, string name)
    {
        var assembly = typeof(ContractJson).Assembly;
        string resource = assembly.GetManifestResourceNames().Single(n => n.EndsWith(name + ".schema.json", StringComparison.Ordinal));
        using var stream = assembly.GetManifestResourceStream(resource)!;
        using var doc = JsonDocument.Parse(stream);
        var errors = new List<string>();
        Visit(value, doc.RootElement, doc.RootElement, name, errors);
        if (errors.Count > 0) throw new ExuiException("package-schema", string.Join("\n", errors.Take(20)));
    }

    private static void Visit(JsonElement v, JsonElement s, JsonElement root, string at, List<string> errors)
    {
        void Error(string msg) => errors.Add($"{at}: {msg}");
        if (s.TryGetProperty("$ref", out var reference))
        {
            string key = reference.GetString()!["#/$defs/".Length..];
            Visit(v, root.GetProperty("$defs").GetProperty(key), root, at, errors);
            return;
        }
        if (s.TryGetProperty("oneOf", out var choices))
        {
            int matches = 0;
            foreach (var choice in choices.EnumerateArray())
            {
                var candidate = new List<string>(); Visit(v, choice, root, at, candidate);
                if (candidate.Count == 0) matches++;
            }
            if (matches != 1)
            {
                Error("must match exactly one supported element (button, label, level).");
                if (v.ValueKind == JsonValueKind.Object && v.TryGetProperty("kind", out var kind) && kind.ValueKind == JsonValueKind.String &&
                    root.GetProperty("$defs").TryGetProperty(kind.GetString()!, out var specific) && kind.GetString() is "button" or "label" or "level")
                    Visit(v, specific, root, at, errors);
            }
            return;
        }
        if (s.TryGetProperty("const", out var c) && !JsonElement.DeepEquals(v, c)) Error($"expected {c.GetRawText()}.");
        if (s.TryGetProperty("enum", out var en) && !en.EnumerateArray().Any(x => JsonElement.DeepEquals(x, v))) Error($"expected one of {en.GetRawText()}.");
        if (s.TryGetProperty("type", out var t))
        {
            bool valid = t.GetString() switch
            {
                "object" => v.ValueKind == JsonValueKind.Object, "array" => v.ValueKind == JsonValueKind.Array,
                "string" => v.ValueKind == JsonValueKind.String, "null" => v.ValueKind == JsonValueKind.Null,
                "boolean" => v.ValueKind is JsonValueKind.True or JsonValueKind.False,
                "number" => v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out double x) && double.IsFinite(x),
                "integer" => TryInteger(v, out _),
                _ => throw new InvalidOperationException("Unsupported embedded schema type.")
            };
            if (!valid) { Error($"expected {t.GetString()}."); return; }
        }
        if (v.ValueKind == JsonValueKind.Object && s.TryGetProperty("properties", out var properties))
        {
            foreach (var required in s.GetProperty("required").EnumerateArray())
                if (!v.TryGetProperty(required.GetString()!, out _)) Error($"missing {required.GetString()}.");
            foreach (var p in v.EnumerateObject())
            {
                if (!properties.TryGetProperty(p.Name, out var rule)) Error($"unsupported property {p.Name}.");
                else Visit(p.Value, rule, root, at + "." + p.Name, errors);
            }
        }
        if (v.ValueKind == JsonValueKind.Array && s.TryGetProperty("items", out var items))
        {
            int count = v.GetArrayLength();
            if (count < s.GetProperty("minItems").GetInt32() || count > s.GetProperty("maxItems").GetInt32()) Error("array length outside supported range.");
            int i = 0; foreach (var item in v.EnumerateArray()) Visit(item, items, root, $"{at}[{i++}]", errors);
        }
        if (v.ValueKind == JsonValueKind.String)
        {
            string str = v.GetString()!;
            int length = str.EnumerateRunes().Count();
            if (s.TryGetProperty("minLength", out var min) && length < min.GetInt32() || s.TryGetProperty("maxLength", out var max) && length > max.GetInt32()) Error("string length outside supported range.");
            if (s.TryGetProperty("pattern", out var pattern) && !Regex.IsMatch(str, pattern.GetString()!, RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1))) Error($"must match {pattern.GetString()}.");
        }
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out double number))
        {
            if (s.TryGetProperty("minimum", out var min) && number < min.GetDouble() || s.TryGetProperty("maximum", out var max) && number > max.GetDouble()) Error("number outside supported range.");
        }
    }
}
