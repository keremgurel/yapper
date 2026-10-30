/** `--name value` pairs into an object; a flag with no value is "true". */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  argv.forEach((arg, i) => {
    if (!arg.startsWith("--")) return;
    const next = argv[i + 1];
    args[arg.slice(2)] =
      next === undefined || next.startsWith("--") ? "true" : next;
  });
  return args;
}

/** A comma separated option as an array, empty when absent. */
export function list(value) {
  return (value ?? "").split(",").filter(Boolean);
}

/** A timestamp usable in a file name. */
export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
