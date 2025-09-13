// Generates placeholder app icons if none are present.
// Writes: build/icon.png (for Electron Windows) using a simple embedded PNG.
// Note: Replace with your real artwork by dropping a 512x512 PNG at build/icon.png

import fs from 'fs';
import path from 'path';

const outDir = path.resolve('build');
const outPng = path.join(outDir, 'icon.png');

// A simple 256x256 PNG placeholder (gradient square with triangle) base64-encoded
// You should replace this with a proper 512x512 icon.
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAA3NCSVQICAjb4U/gAAABc0lEQVR4nO3RMQEAIAwAsWv/0c4xH0iSgHIs7Wgq4y0AAACAb3e3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgJ8iWk0AAc9k9wAAAABJRU5ErkJggg==';

async function ensurePlaceholder() {
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    if (!fs.existsSync(outPng)) {
      fs.writeFileSync(outPng, Buffer.from(pngBase64, 'base64'));
      console.log('Generated placeholder icon at', outPng);
    } else {
      console.log('Icon already exists at', outPng);
    }
  } catch (e) {
    console.error('Failed to generate placeholder icon:', e.message);
  }
}

ensurePlaceholder();

