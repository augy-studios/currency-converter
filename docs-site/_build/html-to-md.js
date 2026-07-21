// Converts one of our page content fragments (see _build/pages/*.html) into
// clean Markdown. This is a small hand-rolled tokenizer/tree-builder, not a
// general HTML parser - it only needs to understand the constrained tag
// vocabulary our fragments actually use (headings, paragraphs, code blocks,
// lists, tables, links, and our own callout/card/stat-grid wrapper divs).
const SITE_ORIGIN = 'https://docs.api.currency.uwuapps.org';

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // must run last, so it doesn't double-decode "&amp;lt;" etc.
}

function stripSvgAndTryIt(html) {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    // Replaced with a placeholder paragraph rather than removed outright,
    // so a "## Try it" heading doesn't end up with nothing under it.
    .replace(/<div class="try-it"[\s\S]*?<\/div>/g, '<p><em>Interactive console omitted here - try it on the live page.</em></p>');
}

function tokenize(html) {
  const tokens = [];
  const re = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    if (!m[0].startsWith('<!--')) tokens.push(m[0]);
  }
  return tokens;
}

function parseTag(tag) {
  const closing = tag.startsWith('</');
  const selfClose = /\/>$/.test(tag);
  const nameMatch = tag.match(/^<\/?([a-zA-Z0-9]+)/);
  const name = nameMatch ? nameMatch[1].toLowerCase() : '';
  const attrs = {};
  const attrRe = /([a-zA-Z-]+)="([^"]*)"/g;
  let am;
  while ((am = attrRe.exec(tag))) attrs[am[1]] = am[2];
  return { name, closing, selfClose, attrs };
}

const VOID_TAGS = new Set(['br', 'img', 'input', 'hr', 'line', 'circle', 'path', 'polygon', 'polyline']);

function buildTree(tokens) {
  const root = { name: 'root', attrs: {}, children: [] };
  const stack = [root];
  for (const tok of tokens) {
    if (tok[0] !== '<') {
      stack[stack.length - 1].children.push({ text: decodeEntities(tok) });
      continue;
    }
    const parsed = parseTag(tok);
    if (parsed.closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === parsed.name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const node = { name: parsed.name, attrs: parsed.attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!parsed.selfClose && !VOID_TAGS.has(parsed.name)) {
      stack.push(node);
    }
  }
  return root;
}

function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function resolveHref(href) {
  if (!href) return '';
  if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:')) return href;
  if (href.startsWith('#')) return href;
  if (href.startsWith('/')) return `${SITE_ORIGIN}${href}`;
  return href;
}

function flattenText(node) {
  if (node.text !== undefined) return node.text;
  return (node.children || []).map(flattenText).join('');
}

function findByClass(node, cls) {
  if (!node) return null;
  if (node.attrs && (node.attrs.class || '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children || []) {
    const found = findByClass(c, cls);
    if (found) return found;
  }
  return null;
}

function renderInline(node) {
  if (node.text !== undefined) return node.text;
  const inner = (node.children || []).map(renderInline).join('');
  switch (node.name) {
    case 'a':
      return `[${inner.trim()}](${resolveHref(node.attrs.href)})`;
    case 'code':
      return `\`${inner.trim()}\``;
    case 'strong':
      return `**${inner.trim()}**`;
    case 'em':
      return `*${inner.trim()}*`;
    case 'br':
      return '\n';
    default:
      return inner;
  }
}

function renderTable(node) {
  const thead = node.children.find(c => c.name === 'thead');
  const tbody = node.children.find(c => c.name === 'tbody');
  const headRow = thead && thead.children.find(c => c.name === 'tr');
  const headers = headRow
    ? headRow.children.filter(c => c.name === 'th').map(th => collapseWhitespace(renderInline(th)))
    : [];
  const bodyRows = tbody ? tbody.children.filter(c => c.name === 'tr') : [];
  const rows = bodyRows.map(tr =>
    tr.children.filter(c => c.name === 'td').map(td => collapseWhitespace(renderInline(td)).replace(/\|/g, '\\|'))
  );
  const lines = [];
  if (headers.length) {
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  }
  rows.forEach(r => lines.push(`| ${r.join(' | ')} |`));
  return lines.join('\n');
}

function renderCardGrid(node) {
  const lines = [];
  (node.children || []).forEach(child => {
    const cls = (child.attrs && child.attrs.class) || '';
    if (child.name === 'a' && cls.split(/\s+/).includes('link-card')) {
      const titleNode = findByClass(child, 'link-card__title');
      const descNode = findByClass(child, 'link-card__desc');
      const title = collapseWhitespace(renderInline(titleNode || child));
      const desc = descNode ? collapseWhitespace(renderInline(descNode)) : '';
      lines.push(`- [${title}](${resolveHref(child.attrs.href)})${desc ? `: ${desc}` : ''}`);
    } else if (child.name === 'div' && cls.split(/\s+/).includes('stat-card')) {
      const labelNode = findByClass(child, 'stat-card__label');
      const valueNode = findByClass(child, 'stat-card__value');
      const label = labelNode ? collapseWhitespace(renderInline(labelNode)) : '';
      const value = valueNode ? collapseWhitespace(renderInline(valueNode)) : '';
      lines.push(`- **${label}:** ${value}`);
    }
  });
  return lines.join('\n');
}

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'table', 'pre', 'div']);

// True if any direct child is itself a block-level tag. Used to decide
// whether an unrecognized wrapper (a plain <div>, or any tag not in the
// switch below) should recurse block-by-block, or - when its children are
// only text/inline tags like <span>/<code>/<a> - be rendered as a single
// inline paragraph instead. Without this, bare inline content sitting
// directly inside a wrapper div (e.g. .tryit__head's badge + <code> path,
// with no <p> around them) would hit the "ignore stray text nodes" guard
// at the top of renderBlock and silently vanish.
function hasBlockChild(node) {
  return (node.children || []).some(c => c.name && BLOCK_TAGS.has(c.name));
}

function renderBlockOrInline(node, blocks) {
  if (hasBlockChild(node)) {
    (node.children || []).forEach(child => renderBlock(child, blocks));
    return;
  }
  const text = collapseWhitespace(renderInline(node));
  if (text) blocks.push(text);
}

function renderBlock(node, blocks) {
  if (node.text !== undefined) return;

  switch (node.name) {
    case 'h1':
      blocks.push(`# ${collapseWhitespace(renderInline(node))}`);
      return;
    case 'h2':
      blocks.push(`## ${collapseWhitespace(renderInline(node))}`);
      return;
    case 'h3':
      blocks.push(`### ${collapseWhitespace(renderInline(node))}`);
      return;
    case 'p':
      blocks.push(collapseWhitespace(renderInline(node)));
      return;
    case 'pre': {
      const codeNode = node.children.find(c => c.name === 'code') || node;
      const raw = flattenText(codeNode).replace(/^\n/, '').replace(/\n$/, '');
      blocks.push('```\n' + raw + '\n```');
      return;
    }
    case 'ul':
    case 'ol': {
      const items = node.children.filter(c => c.name === 'li');
      const lines = items.map((li, i) => {
        const prefix = node.name === 'ul' ? '-' : `${i + 1}.`;
        return `${prefix} ${collapseWhitespace(renderInline(li))}`;
      });
      blocks.push(lines.join('\n'));
      return;
    }
    case 'table':
      blocks.push(renderTable(node));
      return;
    case 'div': {
      const cls = (node.attrs.class || '').split(/\s+/);
      if (cls.includes('callout')) {
        const text = collapseWhitespace(renderInline(node));
        blocks.push(text.split('\n').map(l => `> ${l}`).join('\n'));
        return;
      }
      if (cls.includes('card-grid') || cls.includes('stat-grid')) {
        blocks.push(renderCardGrid(node));
        return;
      }
      // Generic/layout-only div (e.g. .tryit__head, .table-wrap): recurse if
      // it wraps real block content (like .table-wrap around a <table>),
      // otherwise treat its inline content (like .tryit__head's badge +
      // <code> path) as a single paragraph.
      renderBlockOrInline(node, blocks);
      return;
    }
    default:
      renderBlockOrInline(node, blocks);
      return;
  }
}

function htmlFragmentToMarkdown(html) {
  const cleaned = stripSvgAndTryIt(html);
  const tree = buildTree(tokenize(cleaned));
  const blocks = [];
  tree.children.forEach(child => renderBlock(child, blocks));
  return blocks.filter(b => b && b.trim()).join('\n\n').trim() + '\n';
}

module.exports = { htmlFragmentToMarkdown, SITE_ORIGIN };
