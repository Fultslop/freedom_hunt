import { PhotonImage } from "@cf-wasm/photon/node";

const width = 200, height = 200;
const pixels = new Uint8Array(width * height * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = Math.floor(Math.random() * 256);
  pixels[i + 1] = Math.floor(Math.random() * 256);
  pixels[i + 2] = Math.floor(Math.random() * 256);
  pixels[i + 3] = 255;
}

const img = new PhotonImage(pixels, width, height);

for (const q of [0.75, 0.85, 1, 5, 25, 50, 75, 85, 100]) {
  const bytes = img.get_bytes_jpeg(q);
  console.log(`quality=${q}: ${bytes.length} bytes`);
}
