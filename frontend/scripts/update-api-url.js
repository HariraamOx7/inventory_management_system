import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_URL = 'http://localhost:5000/api';
const PROD_URL = 'https://krexports.org/krest';

const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (/\.(jsx?|tsx?|html|css|json)$/i.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(srcDir);

// Detect current configuration
let hasLocalCount = 0;
let hasProdCount = 0;

files.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(LOCAL_URL)) hasLocalCount++;
  if (content.includes(PROD_URL)) hasProdCount++;
});

let mode = (process.argv[2] || '').trim().toLowerCase();

if (!mode || mode === 'toggle') {
  // If mostly localhost, switch to prod; otherwise switch to local
  mode = hasLocalCount >= hasProdCount ? 'prod' : 'dev';
}

let targetUrl = '';
let fromUrls = [];

if (mode === 'prod' || mode === 'production') {
  targetUrl = PROD_URL;
  fromUrls = [LOCAL_URL];
} else if (mode === 'dev' || mode === 'development' || mode === 'local') {
  targetUrl = LOCAL_URL;
  fromUrls = [PROD_URL];
} else {
  // Custom URL passed
  targetUrl = process.argv[2].trim();
  fromUrls = [LOCAL_URL, PROD_URL];
}

console.log('='.repeat(55));
console.log(`🌐 API URL Switcher`);
console.log(`🎯 Target URL: ${targetUrl}`);
console.log(`📂 Scanning: ${srcDir}`);
console.log('='.repeat(55));

let modifiedCount = 0;
let replacementCount = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let fileReplacements = 0;

  fromUrls.forEach((oldUrl) => {
    if (oldUrl !== targetUrl && content.includes(oldUrl)) {
      const parts = content.split(oldUrl);
      fileReplacements += parts.length - 1;
      content = parts.join(targetUrl);
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
    console.log(`  ✓ Updated [${fileReplacements} occurrence(s)]: ${relPath}`);
    modifiedCount++;
    replacementCount += fileReplacements;
  }
});

console.log('-'.repeat(55));
if (modifiedCount === 0) {
  console.log(`ℹ️  No changes needed. All files already point to ${targetUrl}`);
} else {
  console.log(`✨ Successfully updated ${replacementCount} occurrence(s) across ${modifiedCount} file(s).`);
}
console.log('='.repeat(55) + '\n');
