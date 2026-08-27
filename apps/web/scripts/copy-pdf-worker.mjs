// Copies pdfjs-dist's worker into public/ so it can be served as a static asset.
// react-pdf bundles pdfjs-dist internally, so we resolve it relative to react-pdf's
// own install location instead of hardcoding a pnpm store path (which includes the
// version number and shifts under hoisting/node-linker settings).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const reactPdfPkgJson = require.resolve("react-pdf/package.json", { paths: [webRoot] });
const workerSrc = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs", {
  paths: [dirname(reactPdfPkgJson)],
});

const destDir = resolve(webRoot, "public");
mkdirSync(destDir, { recursive: true });
copyFileSync(workerSrc, resolve(destDir, "pdf.worker.min.mjs"));

console.log(`[copy-pdf-worker] copied ${workerSrc} -> public/pdf.worker.min.mjs`);
