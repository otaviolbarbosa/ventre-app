// apps/web/scripts/calibrate-partograph-template.ts
// One-off tool: prints the pixel y-position of every horizontal gridline and the
// pixel x-position of every vertical gridline in the template, so band boundaries
// can be read off precisely instead of eyeballed. Not part of the production build.
//
// Run manually with: npx tsx apps/web/scripts/calibrate-partograph-template.ts
import path from "node:path";
import sharp from "sharp";

async function main() {
  const templatePath = path.join(process.cwd(), "apps/web/src/assets/partograph-template.png");
  const { data, info } = await sharp(templatePath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const darkness = (x: number, y: number) => 255 - (data[y * width + x] ?? 255);

  // A row is a horizontal gridline if most pixels across the full width are dark.
  const rowScores: number[] = [];
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += darkness(x, y) > 100 ? 1 : 0;
    rowScores.push(sum / width);
  }

  // A column is a vertical gridline if most pixels down the full height are dark.
  const colScores: number[] = [];
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += darkness(x, y) > 100 ? 1 : 0;
    colScores.push(sum / height);
  }

  function clusterAboveThreshold(scores: number[], threshold: number): number[] {
    const lines: number[] = [];
    let clusterStart = -1;
    for (let i = 0; i < scores.length; i++) {
      const above = (scores[i] ?? 0) > threshold;
      if (above && clusterStart === -1) clusterStart = i;
      if (!above && clusterStart !== -1) {
        lines.push(Math.round((clusterStart + i - 1) / 2));
        clusterStart = -1;
      }
    }
    if (clusterStart !== -1) lines.push(Math.round((clusterStart + scores.length - 1) / 2));
    return lines;
  }

  console.log("image size:", width, "x", height);
  console.log("horizontal gridlines (y):", clusterAboveThreshold(rowScores, 0.4));
  console.log("vertical gridlines (x):", clusterAboveThreshold(colScores, 0.4));
}

main();
