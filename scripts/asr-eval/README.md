# Transcription eval

Scripts behind `docs/transcription-and-edit-eval-2026-11.md`. They compare speech to text providers on real takes and measure what each transcript does to a 1-Click Edit.

Every script takes a working folder as its first argument. It expects `audio/<take>.m4a` and `fixtures/<take>.project.json` inside it, and writes to `asr/`, `fixtures/` and `cut/`. A project fixture is `{ words, clips, duration }` taken from a Mac project's `project.json`: the transcript of the main take and the source ranges of the clips the finished video kept.

```bash
# 1. Transcribe each take with each provider (Deepgram, Groq, Surplus speech models)
node --env-file=.env.local scripts/asr-eval/transcribe.mjs "$WORK" t3,t4 dg-nova3,groq-turbo,sp-scribe

# 2. Deepgram in fixed pieces: length/overlap in seconds
node --env-file=.env.local scripts/asr-eval/chunked.mjs "$WORK" t3,t4 120/30,15/2

# 3. Word error rate of every transcript against the Scribe reference
python3 scripts/asr-eval/wer.py "$WORK"

# 4. Cut fixtures per transcript source, then run the edit model on them
python3 scripts/asr-eval/make-fixtures.py "$WORK" dg-nova3 dg-c15o2
node --env-file=.env.local --experimental-strip-types --no-warnings \
  scripts/clean-eval/run-many.mjs --fixtures "$WORK/fixtures/t3.dg-c15o2.json" \
  --models gemini-3.7-flash --runs 2 --outdir "$WORK/cut" --tag r1

# 5. Score the cuts
python3 scripts/asr-eval/score-cuts.py "$WORK" "r1.*.jsonl"
```

The take names in `wer.py` and `make-fixtures.py` are the five from November 2026. Change the lists at the top of each for other takes.
