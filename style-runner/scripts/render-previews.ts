import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { useOneReact } from "../webpack-override.ts";

// Renders a still of every template and building block on the drawn sample,
// for the gallery list. Output goes to the web app's public folder, at the
// paths `posterPath` in catalog.ts hands out. The gallery plays the look live.
//   node scripts/render-previews.ts [id ...]   e.g. splits.half-and-half template.half-and-half

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const outDir = path.resolve(root, "../public/style-previews");
const only = new Set(process.argv.slice(2));

mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({
  entryPoint: path.join(root, "src/index.ts"),
  publicDir: path.join(root, "public"),
  webpackOverride: useOneReact,
});

for (const composition of await getCompositions(serveUrl)) {
  const { previewId, posterS } = composition.defaultProps as {
    previewId: string;
    posterS: number;
  };
  if (only.size > 0 && !only.has(previewId)) continue;

  const base = path.join(outDir, previewId);
  await renderStill({
    composition,
    serveUrl,
    output: `${base}.jpg`,
    frame: Math.min(
      composition.durationInFrames - 1,
      Math.round(posterS * composition.fps),
    ),
    imageFormat: "jpeg",
    jpegQuality: 88,
    inputProps: composition.defaultProps,
  });

  console.log(`Rendered ${previewId}`);
}
