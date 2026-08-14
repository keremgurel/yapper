import fs from "node:fs";

export function changedScopes(files) {
  const normalized = files
    .map((file) => file.trim().replaceAll("\\", "/"))
    .filter(Boolean);
  const changesCI = normalized.some(
    (file) =>
      file === ".github/workflows/ci.yml" ||
      file === "src/lib/ci/changed-scopes.mjs" ||
      file === "src/lib/ci/changed-scopes.test.ts",
  );
  const native =
    changesCI || normalized.some((file) => file.startsWith("native-macos/"));
  const web =
    changesCI ||
    normalized.some(
      (file) =>
        file.startsWith("src/") ||
        file.startsWith("public/") ||
        file.startsWith("drizzle/") ||
        file.startsWith("scripts/") ||
        /^(package(-lock)?\.json|next\.config\.[^.]+|tsconfig\.json|vitest\.config\.[^.]+|eslint\.config\.[^.]+|postcss\.config\.[^.]+|drizzle\.config\.[^.]+|components\.json)$/.test(
          file,
        ),
    );
  const postgres =
    changesCI ||
    normalized.some(
      (file) =>
        file.startsWith("drizzle/") ||
        file.startsWith("src/lib/db/") ||
        file.startsWith("src/app/api/") ||
        file.endsWith(".integration.test.ts") ||
        /^(package(-lock)?\.json|drizzle\.config\.[^.]+)$/.test(file),
    );
  return { web, native, postgres };
}

if (
  process.argv[1] &&
  import.meta.filename === fs.realpathSync(process.argv[1])
) {
  const files = fs.readFileSync(0, "utf8").split(/\r?\n/);
  const scopes = changedScopes(files);
  for (const [scope, changed] of Object.entries(scopes)) {
    process.stdout.write(`${scope}=${changed}\n`);
  }
}
