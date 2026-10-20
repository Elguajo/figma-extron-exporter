"""Optional independent schema QA: Python + jsonschema==4.26.0; not a converter dependency.
Run from repository root. Prints evidence; does not modify source examples.
"""
from pathlib import Path
import copy
import importlib.metadata
import json
from jsonschema import Draft202012Validator

print("Independent JSON Schema QA; jsonschema " + importlib.metadata.version("jsonschema"))
count = 0
for name in ("manifest", "screen"):
    schema = json.loads(Path(f"schemas/exui-v1/{name}.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    count += 1
    print("PASS meta-schema " + name)
    validator = Draft202012Validator(schema)
    for profile in ("1025m", "300m"):
        instance = json.loads(Path(f"examples/exui-v1/{profile}/{name}.json").read_text(encoding="utf-8"))
        validator.validate(instance)
        count += 1
        print(f"PASS example {profile}/{name}")
        bad = copy.deepcopy(instance)
        bad["schema"] = "unknown/99"
        assert not validator.is_valid(bad)
        count += 1
        bad = copy.deepcopy(instance)
        bad["unknown"] = True
        assert not validator.is_valid(bad)
        count += 1
        bad = copy.deepcopy(instance)
        del bad["schema"]
        assert not validator.is_valid(bad)
        count += 1
        if name == "screen":
            bad = copy.deepcopy(instance)
            bad["elements"][0]["key"] += "\n"
            assert not validator.is_valid(bad)
            count += 1
for version in (2, 3, 4, 5):
    for name in ("manifest", "screen"):
        schema = json.loads(Path(f"schemas/exui-v{version}/{name}.schema.json").read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        count += 1
        if version != 5:
            continue
        validator = Draft202012Validator(schema)
        for folder in sorted(Path("examples/exui-v5").glob("*/")):
            instance = json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))
            validator.validate(instance)
            count += 1
            for edit in ("unknown", "version", "missing"):
                bad = copy.deepcopy(instance)
                if edit == "unknown": bad["arbitraryField"] = True
                elif edit == "version": bad["schema"] = "unknown/99"
                else: del bad["schema"]
                assert not validator.is_valid(bad)
                count += 1
            print(f"PASS exui/5 {folder.name}/{name}, including malformed root refusals")
print(f"RESULT: {count} passed, 0 failed")
