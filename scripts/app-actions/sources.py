"""Load the hand-edited action groups in protocol/actions/ and bundle them.

common.json holds the bundle header and the definitions more than one group
uses; chirpy-wire.json holds the invocation and plan envelopes. Every other file
is one feature group with a single runtime, and its action IDs start with the
file's prefix (editor-captions.json holds editor.* actions).
"""
import json
import sys

SHARED = ("common", "chirpy-wire")
HEADER = ("$schema", "$id", "title", "x-protocolVersion")
NAMESPACE_RUNTIME = {"editor": "client", "app": "client", "studio": "server"}
CONFIRMED_EFFECTS = {"destructive", "external", "standingRule"}
EFFECT_RUNTIME = {"reversibleEdit": "client", "serverEdit": "server"}
CLIENT_KEYS = {"symbol", "requiresRebuild"}
ACTION_KEYS = {"id", "input", "description", "effect", "confirm", "legacy"} | CLIENT_KEYS
KEYWORDS = {"type", "$ref", "enum", "const", "properties", "required", "additionalProperties",
            "items", "minItems", "maxItems", "uniqueItems", "format", "minLength", "maxLength",
            "minimum", "maximum", "description"}  # description is annotation-only in both validators


def fail(message):
    sys.exit(f"protocol/actions: {message}")


def check_definition(definition, visible, where):
    """Both runtime validators support a small keyword set; refs stay local to the group or shared files."""
    unknown = set(definition) - KEYWORDS
    if unknown:
        fail(f"{where}: add runtime validation before using schema keywords {sorted(unknown)}")
    if "format" in definition and definition["format"] != "uuid":
        fail(f"{where}: only UUID string format is supported by the native validator")
    if "$ref" in definition and definition["$ref"] not in {f"#/$defs/{name}" for name in visible}:
        fail(f"{where}: {definition['$ref']} must name a definition in this group or a shared file")
    if isinstance(definition.get("additionalProperties"), dict) and definition["additionalProperties"]:
        fail(f"{where}: typed additional properties are not supported")
    for child in definition.get("properties", {}).values():
        check_definition(child, visible, where)
    if "items" in definition:
        check_definition(definition["items"], visible, where)


def check_action(stem, runtime, action, effects, local_defs):
    where = f"{stem}.json {action.get('id')}"
    unknown = set(action) - ACTION_KEYS
    if unknown:
        fail(f"{where}: unknown action fields {sorted(unknown)}; runtime comes from the group")
    if not action.get("id", "").startswith(stem.split("-")[0] + "."):
        fail(f"{where}: action IDs in {stem}.json start with {stem.split('-')[0]}.")
    if action.get("input") not in local_defs:
        fail(f"{where}: input must be a definition in {stem}.json")
    if not isinstance(action.get("description"), str) or not action["description"]:
        fail(f"{where}: description is required")
    effect = action.get("effect")
    if effect not in effects:
        fail(f"{where}: effect must be one of {effects}")
    if EFFECT_RUNTIME.get(effect, runtime) != runtime:
        fail(f"{where}: {effect} actions run on the {EFFECT_RUNTIME[effect]}")
    if effect in CONFIRMED_EFFECTS and action.get("confirm") is not True:
        fail(f"{where}: {effect} actions must set confirm: true")
    if not isinstance(action.get("confirm", False), bool):
        fail(f"{where}: confirm must be a boolean")
    if runtime == "client" and not (isinstance(action.get("symbol"), str) and isinstance(action.get("requiresRebuild"), bool)):
        fail(f"{where}: client actions need a Swift symbol and requiresRebuild")
    if runtime != "client" and CLIENT_KEYS & set(action):
        fail(f"{where}: {sorted(CLIENT_KEYS & set(action))} only apply to client actions")


def load(folder):
    files = {path.stem: json.loads(path.read_text()) for path in sorted(folder.glob("*.json"))}
    for stem in SHARED:
        if stem not in files:
            fail(f"missing {stem}.json")
    files = {stem: files[stem] for stem in [*SHARED, *(stem for stem in files if stem not in SHARED)]}
    allowed = {"common": {"description", "$defs", *HEADER}, "chirpy-wire": {"description", "$defs"}}
    for stem, doc in files.items():
        unknown = set(doc) - allowed.get(stem, {"description", "runtime", "actions", "$defs"})
        if unknown:
            fail(f"{stem}.json: unknown top-level fields {sorted(unknown)}")
    return files


def bundle(folder):
    """Return the full bundle and the client-only bundle that native embeds."""
    files = load(folder)
    owner = {}
    for stem, doc in files.items():
        for name in doc.get("$defs", {}):
            if name in owner:
                fail(f"{name} is defined in both {owner[name]}.json and {stem}.json")
            owner[name] = stem
    shared = {name for name, stem in owner.items() if stem in SHARED}
    vocab = files["common"]["$defs"]
    runtimes, effects = vocab["AppActionRuntime"]["enum"], vocab["AppActionEffect"]["enum"]

    actions, client_stems = [], set(SHARED)
    for stem, doc in files.items():
        local = set(doc.get("$defs", {}))
        for name, definition in doc.get("$defs", {}).items():
            check_definition(definition, shared | (set() if stem in SHARED else local), f"{stem}.json {name}")
        if stem in SHARED:
            continue
        runtime = doc.get("runtime")
        if runtime not in runtimes or NAMESPACE_RUNTIME.get(stem.split("-")[0]) != runtime:
            fail(f"{stem}.json: runtime must be {NAMESPACE_RUNTIME.get(stem.split('-')[0], 'a namespace listed in NAMESPACE_RUNTIME')}")
        if runtime == "client":
            client_stems.add(stem)
        for action in doc.get("actions", []):
            check_action(stem, runtime, action, effects, local)
            actions.append({**action, "runtime": runtime})

    # Sorted so the catalog order, and the planner prompt built from it, does not depend on which file holds an action.
    actions.sort(key=lambda action: action["id"])
    for field in ("id", "symbol"):
        values = [action[field] for action in actions if field in action]
        duplicates = sorted({value for value in values if values.count(value) > 1})
        if duplicates:
            fail(f"duplicate action {field}s {duplicates}")

    header = {key: files["common"][key] for key in HEADER}
    definitions = {name: definition for doc in files.values() for name, definition in doc.get("$defs", {}).items()}
    full = {**header, "x-actions": actions, "$defs": definitions}
    client = {**header, "x-actions": [action for action in actions if action["runtime"] == "client"],
              "$defs": {name: definition for name, definition in definitions.items() if owner[name] in client_stems}}
    return full, client
