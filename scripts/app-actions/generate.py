"""Bundle protocol/actions/*.json and generate the native and web contracts from it.

Run with --check in CI. The runtime validates the schema before decoding inputs;
these generated types are the ergonomic API, not a substitute for validation.
Swift gets client-runtime groups only, so server-only groups never touch the
native build.
"""
import json
import pathlib
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repo when importing the sibling modules
from emit_swift import swift_contract  # noqa: E402
from emit_typescript import studio_registry, typescript_contract  # noqa: E402
from sources import bundle  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
full, client = bundle(ROOT / "protocol/actions")

outputs = {
    ROOT / "protocol/app-actions.schema.json": json.dumps(full, indent=2, ensure_ascii=False) + "\n",
    ROOT / "protocol/app-actions.generated.ts": typescript_contract(full),
    ROOT / "src/lib/chirpy/studio/registry.generated.ts": studio_registry(full),
    ROOT / "native-macos/Sources/YapperNative/Models/Actions/AppActionContract.generated.swift": swift_contract(client),
}
for path, content in outputs.items():
    if "--check" in sys.argv:
        if not path.exists() or path.read_text() != content:
            sys.exit(f"Stale action contract: {path.relative_to(ROOT)}; edit protocol/actions/ and run python3 scripts/app-actions/generate.py")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
