import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDist = path.resolve(__dirname, '../../api-server/dist');
const envFile = path.resolve(__dirname, '../../../.env');

const targetDir = path.resolve(__dirname, '../dist/backend');
const targetDist = path.join(targetDir, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(apiDist)) {
  console.error("API Server dist not found. Please build api-server first.");
  process.exit(1);
}

copyDir(apiDist, targetDist);

if (fs.existsSync(envFile)) {
  fs.copyFileSync(envFile, path.join(targetDir, '.env'));
  console.log("Copied .env to backend bundle.");
} else {
  console.warn("No .env file found in root.");
}

console.log("Backend bundled successfully!");
