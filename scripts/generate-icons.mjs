// Regenerates the PWA icons from public/icons/icon.svg.
// Run after changing the SVG: `npm run icons`
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dir = new URL("../public/icons/", import.meta.url);
const out = (name) => fileURLToPath(new URL(name, dir));
const svg = await readFile(out("icon.svg"));
const BG = "#0b0b0f";

async function plain(size, name) {
  await sharp(svg).resize(size, size).png().toFile(out(name));
}

// Maskable icons need the artwork inside the central 80% safe zone.
async function maskable(size, name) {
  const inner = Math.round(size * 0.8);
  const art = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(out(name));
}

await plain(192, "icon-192.png");
await plain(512, "icon-512.png");
await maskable(512, "icon-maskable-512.png");
await maskable(180, "apple-touch-icon.png");
console.log("Icons written to public/icons/");
