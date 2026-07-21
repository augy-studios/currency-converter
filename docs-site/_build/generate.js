// Regenerates the docs-site HTML pages (and their .md counterparts) from
// template.html + pages/*.html content fragments. Run with:
//   node _build/generate.js
const fs = require('fs');
const path = require('path');
const { htmlFragmentToMarkdown, SITE_ORIGIN } = require('./html-to-md.js');

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

  // Every page is also available as plain Markdown by appending .md to its
  // URL (e.g. /quickstart.md) - useful for LLMs/agents that would rather not
  // parse HTML. Interactive "Try it" consoles are omitted since they only
  // make sense in a browser; a footer line points back to the live page.
  const pageUrl = page.id === 'index' ? '/' : `/${page.id}`;
  const md = htmlFragmentToMarkdown(content) +
    `\n---\n*Interactive version: ${SITE_ORIGIN}${pageUrl}*\n`;
  const mdPath = path.join(ROOT, `${page.id}.md`);
  fs.writeFileSync(mdPath, md);
  console.log('wrote', `${page.id}.md`);
}
