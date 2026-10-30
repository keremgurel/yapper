"""Swift and TypeScript declarations for each schema definition."""
import json


def typename(prop, swift):
    if "$ref" in prop:
        return prop["$ref"].split("/")[-1]
    kind = prop["type"]
    if kind == "array":
        inner = typename(prop["items"], swift)
        return f"[{inner}]" if swift else f"Array<{inner}>"
    if kind == "object":
        assert prop.get("additionalProperties") == {}, "Use a named definition for structured objects"
        return "[String: ActionJSON]" if swift else "Record<string, unknown>"
    if swift and prop.get("format") == "uuid":
        return "UUID"
    return ({"string": "String", "integer": "Int", "number": "Double", "boolean": "Bool"}
            if swift else {"string": "string", "integer": "number", "number": "number", "boolean": "boolean"})[kind]


def swift_declarations(definitions):
    lines = []
    for name, definition in definitions.items():
        if "enum" in definition:
            lines += [f"enum {name}: String, Codable, Equatable, Sendable {{"]
            lines += [f"    case {value}" for value in definition["enum"]]
            lines += ["}", ""]
            continue
        lines += [f"struct {name}: Codable, Equatable, Sendable {{"]
        for field, prop in definition["properties"].items():
            optional = field not in definition["required"]
            lines += [f'    let {field}: {typename(prop, True)}{"?" if optional else ""}']
        lines += ["}", ""]
    return lines


def typescript_declarations(definitions):
    lines = []
    for name, definition in definitions.items():
        if "enum" in definition:
            lines += [f"export type {name} = " + " | ".join(json.dumps(value) for value in definition["enum"]) + ";", ""]
            continue
        lines += [f"export interface {name} {{"]
        for field, prop in definition["properties"].items():
            optional = field not in definition["required"]
            lines += [f'  {field}{"?" if optional else ""}: {typename(prop, False)};']
        lines += ["}", ""]
    return lines
