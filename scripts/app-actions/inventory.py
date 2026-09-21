"""List every EditorSession method the native UI calls, and how each one commits.

The output is the raw material for docs/native-action-inventory.md and, later,
the allowlist for the view-boundary lint described in
docs/chirpy-shared-actions.md step 5. Run it from the repo root:

    python3 scripts/app-actions/inventory.py            # human-readable table
    python3 scripts/app-actions/inventory.py --json     # machine-readable

A method "commits" when its body, or a session method it calls (up to four
levels deep), reaches one of the seams below. Methods with no path to a seam
are selection, playback, preview, gesture bookkeeping, or reads.
"""
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "native-macos/Sources/YapperNative"
CALLERS = [SOURCE / "Views", SOURCE / "App"]
SESSION_FILES = lambda rel: rel == "EditorSession.swift" or rel.startswith("Session/") or rel.startswith("App/")

# Anything that changes the saved project, the account dictionary, or runs a
# tracked operation. `updateProject` is the raw project mutation; the commit
# wrappers around it decide persistence, rebuild, and Undo.
SEAMS = [
    "performAppAction", "executeBatch",
    "commitTimelineEdit", "commitPreparedTimelineEdit", "scheduleVisualCommit", "scheduleCompositionCommit",
    "runTrackedLongOperation", "startTrackedLongOperation",
    "updateProject", "persist(", "recordHistory",
    "DictionaryStore.shared",
]
REGISTERED = {"performAppAction", "executeBatch"}


def body_of(text, start):
    i = text.find("{", start)
    if i < 0:
        return ""
    depth = 0
    for j in range(i, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return text[i:j + 1]
    return text[i:]


def session_functions():
    funcs = collections.defaultdict(list)
    for path in SOURCE.rglob("*.swift"):
        rel = str(path.relative_to(SOURCE))
        if not SESSION_FILES(rel):
            continue
        text = path.read_text()
        for match in re.finditer(r"\bfunc ([a-zA-Z]+)\b", text):
            line = text[:match.start()].count("\n") + 1
            funcs[match.group(1)].append((rel, line, body_of(text, match.end())))
    return funcs


def seam_in(body):
    for seam in SEAMS:
        if re.search(r"\b" + re.escape(seam), body):
            return seam.rstrip("(")
    return None


def seam_path(funcs, name, depth=0, seen=None):
    seen = seen if seen is not None else set()
    if name in seen or name not in funcs or depth > 4:
        return None
    seen.add(name)
    for _, _, body in funcs[name]:
        seam = seam_in(body)
        if seam:
            return [name, seam]
        for callee in sorted(set(re.findall(r"\b([a-z][A-Za-z]+)\(", body))):
            if callee == name:
                continue
            path = seam_path(funcs, callee, depth + 1, seen)
            if path:
                return [name] + path
    return None


def call_sites():
    calls = collections.defaultdict(list)
    for folder in CALLERS:
        for path in folder.rglob("*.swift"):
            for number, line in enumerate(path.read_text().splitlines(), 1):
                for match in re.finditer(r"session\.([a-zA-Z]+)\(", line):
                    calls[match.group(1)].append(f"{path.relative_to(SOURCE)}:{number}")
    return calls


def inventory():
    funcs = session_functions()
    rows = []
    for name, sites in sorted(call_sites().items()):
        rel, line, _ = funcs.get(name, [("?", 0, "")])[0]
        path = seam_path(funcs, name)
        rows.append({
            "method": name,
            "definedAt": f"{rel}:{line}",
            "commitPath": path[1:] if path else [],
            "mutates": bool(path),
            "registered": bool(path) and any(step in REGISTERED for step in path),
            "callSites": sites,
        })
    return rows


if __name__ == "__main__":
    rows = inventory()
    if "--json" in sys.argv:
        json.dump(rows, sys.stdout, indent=1)
        sys.exit()
    for row in rows:
        kind = "registered" if row["registered"] else "mutates" if row["mutates"] else "-"
        print(f"{row['method']:32} {kind:11} {'>'.join(row['commitPath']):50} {row['definedAt']}")
    mutating = [r for r in rows if r["mutates"]]
    print(f"\n{len(rows)} methods called from UI; {len(mutating)} commit; "
          f"{sum(r['registered'] for r in mutating)} of those go through the action registry.")
