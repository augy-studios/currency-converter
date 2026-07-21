// Regenerates the docs-site HTML pages from template.html + pages/*.html
// content fragments. Run with: node _build/generate.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages.json'), 'utf8'));

function esc(str) {
  return String(str).replace(/"/g, '&quot;');
}

for (const page of pages) {
  const fragPath = path.join(__dirname, 'pages', page.file);
  const content = fs.readFileSync(fragPath, 'utf8').trimEnd();

  let html = template
    .replaceAll('{{TITLE}}', esc(page.title))
    .replaceAll('{{DESC}}', esc(page.desc))
    .replaceAll('{{PAGE_ID}}', page.id)
    .replace('{{CONTENT}}', content);

  const outPath = path.join(ROOT, page.file);
  fs.writeFileSync(outPath, html);
  console.log('wrote', page.file);
}
