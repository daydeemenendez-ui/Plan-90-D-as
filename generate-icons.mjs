import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "public", "favicon.png");

const sizes = [
  { size: 192, name: "pwa-192x192.png" },
  { size: 512, name: "pwa-512x512.png" },
  { size: 180, name: "apple-touch-icon.png" },
];

for (const { size, name } of sizes) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(join(__dirname, "public", name));
  console.log(`✅ Generado: public/${name} (${size}x${size})`);
}

console.log("🎉 Todos los iconos PWA generados.");
