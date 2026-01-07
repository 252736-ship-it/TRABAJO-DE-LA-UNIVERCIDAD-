import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'node_modules', 'onnxruntime-web', 'dist');
const outDir = path.join(projectRoot, 'public', 'ort');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  await fs.copyFile(src, dest);
}

async function main() {
  await ensureDir(outDir);

  let entries;
  try {
    entries = await fs.readdir(distDir, { withFileTypes: true });
  } catch {
    // Dependencia no instalada aún (o instalación fallida)
    return;
  }

  const allow = new Set(['.wasm', '.mjs', '.js']);
  const shouldCopy = (name) =>
    name.startsWith('ort-wasm') && allow.has(path.extname(name)) && !name.endsWith('.d.ts');

  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter(shouldCopy);

  await Promise.all(
    files.map(async (name) => {
      const src = path.join(distDir, name);
      const dest = path.join(outDir, name);
      await copyFile(src, dest);
    }),
  );
}

main();
