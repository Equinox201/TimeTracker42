// Records the demo walkthrough GIF used in the README.
//
//   cd web && npm run build && npx vite preview --port 4180 &      # serve the production build
//   npm install --no-save gifenc pngjs                              # one-off encoder dependencies
//   BASE_URL=http://127.0.0.1:4180 PW_CHANNEL=chrome node e2e/tools/make-walkthrough.mjs
//
// Output: ../assets/screenshots/walkthrough.gif (~0.5 MB). Not part of the test suite.
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:4180";
const OUTPUT = new URL("../../../assets/screenshots/walkthrough.gif", import.meta.url).pathname;

import { chromium } from "playwright-core";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import pngjs from "pngjs";
const { PNG } = pngjs;
import fs from "node:fs";

const W = 1000, H = 640;          // capture size
const OUT_W = 880, OUT_H = 563;   // GIF size (box-downscaled)
const frames = [];                // { png: Buffer, delay: number }

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "dark" });
await page.addInitScript(() => localStorage.clear());

async function shot(delay) {
  frames.push({ png: await page.screenshot(), delay });
}
async function burst(count, gap, delay) {
  for (let i = 0; i < count; i += 1) {
    await shot(delay);
    if (i < count - 1) await page.waitForTimeout(gap);
  }
}

// 1. Landing
await page.goto(`${BASE_URL}/login`);
await page.getByRole("button", { name: "Try the demo" }).waitFor();
await page.waitForTimeout(1800);
await burst(2, 400, 600);
await shot(1300);

// 2. Dashboard (hero counts up, chart draws in)
await page.getByRole("button", { name: "Try the demo" }).click();
await page.getByRole("progressbar").waitFor();
await burst(9, 140, 130);
await page.waitForTimeout(1500);
await shot(1600);

// 3. Planner: the whole month, then an impossible plan and its fix
await page.getByRole("link", { name: "Plan" }).first().click();
await page.getByText("Tap a day to take it off").waitFor();
await page.waitForTimeout(600);
await page.getByText("Tap a day to take it off").evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.waitForTimeout(500);
await shot(1400);

const weekend = page.getByRole("button", { name: /, not planned$/ }).first();
await weekend.click();
await page.waitForTimeout(400);
await shot(1200);

await page.getByLabel("Most hours I will stay on one day").fill("2");
await page.waitForTimeout(500);
await page.getByText("Not reachable with this schedule").scrollIntoViewIfNeeded();
await shot(1800);

await page.getByRole("button", { name: "Apply" }).first().click();
await page.waitForTimeout(500);
await page.getByText("Reachable").first().scrollIntoViewIfNeeded();
await shot(2000);

await browser.close();

// ---- encode ----
function downscale(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const y0 = Math.floor((y * sh) / dh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x += 1) {
      const x0 = Math.floor((x * sw) / dw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 1) for (let xx = x0; xx < x1; xx += 1) {
        const i = (yy * sw + xx) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; n += 1;
      }
      const o = (y * dw + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return out;
}

const gif = GIFEncoder();
for (const { png, delay } of frames) {
  const img = PNG.sync.read(png);
  const rgba = downscale(img.data, img.width, img.height, OUT_W, OUT_H);
  const palette = quantize(rgba, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(rgba, palette, "rgb565"), OUT_W, OUT_H, { palette, delay });
}
gif.finish();
fs.writeFileSync(OUTPUT, gif.bytes());
console.log(`frames: ${frames.length}, bytes: ${gif.bytes().length}`);
