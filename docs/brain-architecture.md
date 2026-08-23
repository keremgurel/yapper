# The Brain

The standing knowledge every AI feature in Studio reads before it writes, and
the machinery that decides how much of it any one prompt gets.

## The problem this shape solves

The first version compiled a creator's whole brain into a single 2400 character
string and appended it to every AI call. Everything was always on, and the
compiler dropped whole lines off the end when it overflowed. A 48 row content
gap export or a keyword research file could not go in, because it would silently
evict the audience description on its way past.

The fix is the trick agent skills use. A one line digest of everything is always
in the prompt; the full text is loaded only for the task that needs it. The brain
becomes unbounded without the prompt becoming unbounded.

## The three parts of a compiled prompt

| Part   | What it is                                              | Cost                               |
| ------ | ------------------------------------------------------- | ---------------------------------- |
| CORE   | Identity fields, pillars, and sections marked always-on | Paid every call                    |
| INDEX  | One line per routable section and enabled skill         | Paid every call, about a line each |
| LOADED | The skills and sections this task selected, in full     | Paid per task                      |

Section order in the system prompt is deliberate: fixed instructions, then CORE,
then INDEX, then LOADED. The first three are byte stable for a given
`contextVersion`, so provider prefix caching covers everything up to the loaded
tail. Only the tail varies between two calls from the same brain.

The INDEX carries an instruction of its own, and it is load bearing: the model is
told it has not read those entries and must never quote them. Without it, a line
saying "Keyword research, 240 rows" gets cited as though the rows were present.

## Sections

`project_brain_blocks` holds four kinds. `note` is prose, `list` is collected
lines, `table` is an imported grid, and `doc` is a long document split into
`project_brain_chunks`.

`usage` decides how much of a section reaches a prompt, and it is the whole
contract:

- `core` is read on every writing call, capped at four sections.
- `auto` is routable: its digest is always visible, its contents load when the
  task calls for them.
- `manual` is hidden from the router and loads only when attached by hand.
- `private` never leaves the page.

Inside a selected section, the contents are cut to fit deterministically. A 200
row table contributes its column headers and the dozen rows that overlap the
task, plus a line saying how many were dropped. A document contributes the two
chunks that mention what is being written, put back in document order.

## Skills

`project_skills` holds procedures rather than facts: "when you write a script for
me, open on the turn". Each declares a `whenToUse` line, which is what the router
reads, and a set of surfaces it applies to. An empty surface list means all of
them.

Installing from `skill_catalog` takes a copy. The creator owns and can rewrite
it, and editing a catalog entry never rewrites a brain behind someone's back;
it bumps the entry's `version`, which is what offers the update.

## Selection

`src/lib/brain/context/select.ts` decides what LOADED holds, in this order:

1. Four or fewer routable items: load all of them. Choosing costs more than
   reading, and a new creator never waits on a call with no decision in it.
2. A cached decision for this brain, surface and task: reuse it. Regenerating a
   script routes once.
3. The router: a small model reads the INDEX and returns refs. Temperature 0,
   four second timeout, 160 output tokens, no retries, its own rate limit scope,
   and a breaker that stops calling after three consecutive failures.
4. Anything else: `select-rules.ts`, which ranks by declared surface and word
   overlap.

The router is an optimizer, never a dependency. Timeout, bad JSON, missing key,
rate limit, open breaker: every one of them lands on the rules and the generation
proceeds. `select.test.ts` asserts it.

Routing costs no credits and does not touch the shared `user:provider-spend`
budget. It is a call made on the creator's behalf inside a generation they
already paid for, so spending their generation allowance on it would be
indefensible. `guardRouterSpend` consumes only the `brain-route` scope and
answers a boolean.

Every generate route returns `used: { skills, context }`, which is what the
"Read from your brain" line under a result renders.

## Budgets

Characters, not tokens, because characters are measurable without a tokenizer.
Roughly four characters to a token. See `budgets.ts` for the table; the shape is
that writing surfaces get more than classification surfaces, and `capture` gets
pillars only with no index and nothing loaded.

## Import

`detect.ts` parses a paste in the browser, in full and for free: CSV and TSV by
delimiter agreement plus a check that the cells read as values rather than
sentences, JSON arrays of objects by key union, markdown lists by bullet prefix.
Only a twenty row sample and a sentence describing the shape reach
`/api/brain/ingest`, which asks a model for a title, a digest and tags. That is
why a five thousand row export is instant and costs the same to name as five
rows.

## Environment

| Variable             | Required | What it does                                                                                                                       |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `BRAIN_ROUTER_MODEL` | No       | Model for the router. Falls back to `GENERATE_MODEL`. Point it at something cheap.                                                 |
| `ADMIN_USER_IDS`     | No       | Comma separated Clerk ids allowed into the catalog admin at `/studio/admin/skills`. Unset means nobody, and the routes answer 404. |

## Where things live

`src/lib/brain/context/` is the compiler, one file per job, all pure except
`select-model.ts` and `server.ts`. `server.ts` caches the loaded rows by
`contextVersion`, which every project, pillar, section and skill write bumps.
`src/components/brain/` is the page. `src/app/api/brain/preview` compiles what a
surface would read without spending a router call, which is what the page's
"What the AI reads" panel renders.
