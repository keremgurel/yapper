// Stops `npm install` or `yarn` in this repository. Dependencies are locked in
// pnpm-lock.yaml, and pnpm links them from one shared store, which is what
// keeps each agent worktree from costing a full node_modules on disk. Another
// package manager would write its own lockfile and a second, unlinked tree.
const agent = process.env.npm_config_user_agent ?? "";

if (!agent.startsWith("pnpm/")) {
  console.error(
    "\nThis repository uses pnpm. Run `pnpm install` instead (see AGENTS.md).\n",
  );
  process.exit(1);
}
