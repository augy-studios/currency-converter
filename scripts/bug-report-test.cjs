// Report a bug: the edge tray's form (main-site/js/bug-report.js) and the function that sends
// it to Augy on Telegram (main-site/api/bug-report.js). Telegram and Redis are stand-ins here:
// nothing is sent, and no real token is used.
//
//   node scripts/bug-report-test.cjs
//
// The function is run as Vercel would run it, on made-up requests, with fetch answered here. The
// form itself is driven by Playwright in flutter/e2e/tests/site.spec.js.
//
// What it checks:
//   1. Not set up (no token or chat), it says so, 503, and sends nothing.
//   2. Only POST; only from the site's own page when a browser says where it's from.
//   3. Nothing said, or too much, is refused, and nothing is sent.
//   4. A report goes to the chat as a rich message (sendRichMessage): a heading, a table with
//      the app, device, page and contact, and what was typed escaped, so it reads as it was
//      (<b> and all), the token only in Telegram's address. A chat that won't take a rich
//      message gets it as plain text (sendMessage).
//   5. Two a minute from one IP; with Redis, six an hour from one IP, sixty from everyone.
//   6. The field only a bot fills in: told it went, nothing sent.
//   7. Telegram failing or slow is a 502 that says to try again, with no token in the logs.
//   9. Several chats: each gets it (a topic's ID too), one taking it is enough, all failing is
//      a 502, and what isn't a chat is left out.
//  10. Pictures: up to three images, uploaded with the rich message and shown in it, each a
//      tg://photo?id= block; where the rich message won't go, sent after the plain one and
//      replying to it, one as a photo and more as an album; four, a non-image or one too big
//      is refused, sending nothing; the pictures failing still leaves the report sent.
//  11. Each report has an ID, the day in Singapore and four letters, answered and in the message;
//      a whole-page screenshot (`full`) goes as a file too, replying to the report, and the
//      report counts as sent even if the file doesn't.
const path = require('path');
const fs = require('fs');

const TOKEN = '123456:TEST-not-a-real-token';
const CHAT = '424242';
const REDIS = 'https://redis.test';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` :: ${extra}` : ''}`); if (!cond) fails++; };

// Telegram and Redis, as fetch sees them: every call kept in `sent`, Redis counted in `counts`.
const sent = [];
const counts = new Map();
let telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });
global.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url === REDIS) {
    const [cmd, key] = JSON.parse(opts.body);
    if (cmd === 'INCR') counts.set(key, (counts.get(key) || 0) + 1);
    const result = cmd === 'INCR' ? counts.get(key) : 1;
    return new Response(JSON.stringify({ result }), { status: 200 });
  }
  if (url.startsWith('https://api.telegram.org/')) {
    // A picture goes as a form: its files kept as what they are, not their bytes.
    const body = opts.body instanceof FormData
      ? Object.fromEntries([...opts.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : { file: true, size: v.size, type: v.type, name: v.name }]))
      : JSON.parse(opts.body);
    sent.push({ url, body });
    const r = await telegram(opts);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }
  throw new Error(`unexpected fetch ${url}`);
};

// A rich message's Markdown and media, from what was sent.
const rich = (x) => { try { return JSON.parse(x?.body.rich_message); } catch { return null; } };
// Telegram refusing rich messages only: as an older Bot API or a chat that won't have them.
const noRich = (then) => (opts) => (opts.body instanceof FormData && opts.body.has('rich_message') ? { status: 400, body: { ok: false, description: 'Bad Request: rich messages are not allowed' } } : then(opts));

// A Vercel request and response, enough for the function.
let ipSeq = 0;
function call(handler, { method = 'POST', body, headers = {}, ip = `10.0.0.${++ipSeq}` } = {}) {
  const req = { method, body, query: {}, headers: { host: 'currency.test', 'x-real-ip': ip, ...headers } };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {}, payload: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(d) { this.payload = d; resolve(this); return this; },
      end() { resolve(this); return this; },
    };
    Promise.resolve(handler(req, res)).catch((e) => { res.statusCode = 'threw'; res.payload = String(e); resolve(res); });
  });
}

const REPORT = {
  text: 'The <b>rate date</b> on my graph shows "Invalid" & never changes.\nSteps: open it, wait.',
  contact: '@someone',
  version: '1.0.1',
  platform: 'android',
  device: 'Android 14 · Chrome 130 · 412×915',
  page: 'Converter, Theme',
};

async function api() {
  // Redis on (it's read as the module loads), for the hour's limits.
  process.env.KV_REST_API_URL = REDIS;
  process.env.KV_REST_API_TOKEN = 'redis-test-token';
  const handler = require(path.join(__dirname, '../main-site/api/bug-report.js'));

  delete process.env.BUG_REPORT_BOT_TOKEN;
  delete process.env.BUG_REPORT_CHAT_ID;
  let r = await call(handler, { body: REPORT });
  ok('1. not set up: 503 with a message', r.statusCode === 503 && /can't be sent/.test(r.payload?.error), r.payload?.error);
  process.env.BUG_REPORT_BOT_TOKEN = TOKEN;
  r = await call(handler, { body: REPORT });
  ok('1. a token but no chat is still not set up', r.statusCode === 503);
  process.env.BUG_REPORT_CHAT_ID = CHAT;
  ok('1. nothing sent while not set up', sent.length === 0);

  r = await call(handler, { method: 'GET' });
  ok('2. GET refused', r.statusCode === 405 && r.headers.allow === 'POST');
  r = await call(handler, { body: REPORT, headers: { origin: 'https://evil.example' } });
  ok('2. another site\'s page refused', r.statusCode === 403);
  r = await call(handler, { body: REPORT, headers: { origin: 'not a url' } });
  ok('2. a nonsense Origin refused', r.statusCode === 403);

  for (const [label, body, code] of [
    ['no body', undefined, 400],
    ['no text', { ...REPORT, text: '' }, 400],
    ['only spaces', { ...REPORT, text: '   \n  ' }, 400],
    ['text not a string', { ...REPORT, text: ['a', 'b', 'c', 'd', 'e', 'f'] }, 400],
    ['over 2,000 characters', { ...REPORT, text: 'x'.repeat(2001) }, 400],
    ['over 8 KB in all', { ...REPORT, device: 'y'.repeat(9000) }, 413],
  ]) {
    r = await call(handler, { body });
    ok(`3. ${label}: ${code}`, r.statusCode === code, `${r.statusCode} ${r.payload?.error || ''}`);
  }
  ok('3. nothing sent for any of them', sent.length === 0);

  r = await call(handler, { body: REPORT, headers: { origin: 'https://currency.test' } });
  ok('4. a report from the site: 200', r.statusCode === 200, `${r.statusCode} ${JSON.stringify(r.payload)}`);
  const rm = sent[0];
  ok('4. one call, to Telegram\'s sendRichMessage with the bot\'s token', sent.length === 1 && rm?.url === `https://api.telegram.org/bot${TOKEN}/sendRichMessage`, rm?.url);
  ok('4. to the chat set', rm?.body.chat_id === CHAT);
  ok('4. no parse_mode', rm && !('parse_mode' in rm.body));
  const md = rich(rm)?.markdown || '';
  ok('4. answers the report\'s ID', /^\d{8}-[2-9A-HJKMNP-Z]{4}$/.test(r.payload?.id || ''), JSON.stringify(r.payload));
  ok('4. the ID in the table too', md.includes(`| Report | ${r.payload?.id} |`), md.split('\n').slice(0, 8).join(' / '));
  ok('4. a heading with the report\'s ID, then the details as a table', /^# Bug report \d{8}-[2-9A-HJKMNP-Z]{4}\n/.test(md) && md.includes('| Detail | Given |\n| --- | --- |'), JSON.stringify(md));
  ok('4. the app and its version, the device, page and contact', md.includes('| App | Android app 1.0.1 |') && md.includes('| Device | Android 14 · Chrome 130 · 412×915 |') && md.includes('| Page | Converter, Theme |') && !md.includes('Language') && md.includes('| Contact | @someone |'), JSON.stringify(md));
  ok('4. what was typed under its heading, escaped, a line a line', md.includes('## What went wrong\n\nThe \\<b\\>rate date\\</b\\> on my graph shows "Invalid" \\& never changes.  \nSteps: open it, wait.'), JSON.stringify(md));
  ok('4. no pictures, no media', !('media' in (rich(rm) || {})) && !/tg:\/\/photo/.test(md));
  ok('4. no token in the message', !md.includes(TOKEN));
  const { escapeMd } = handler;
  ok('4. Markdown, HTML and Rich Markdown\'s own marks escaped', escapeMd('*b* _i_ `c` [l](u) <u> ==m== ||s|| $x$ #h a|b \\') === '\\*b\\* \\_i\\_ \\`c\\` \\[l\\]\\(u\\) \\<u\\> \\=\\=m\\=\\= \\|\\|s\\|\\| \\$x\\$ \\#h a\\|b \\\\', escapeMd('*b* _i_ `c` [l](u) <u> ==m== ||s|| $x$ #h a|b \\'));
  ok('4. a line that would be a list isn\'t', escapeMd('- a\n+ b\n 2. c\n3) d\n-5 stays') === '\\- a\n\\+ b\n 2\\. c\n3\\) d\n-5 stays', JSON.stringify(escapeMd('- a\n+ b\n 2. c\n3) d\n-5 stays')));
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, device: 'Pixel | Chrome' } });
  ok('4. a | in a table cell escaped', (rich(sent[0])?.markdown || '').includes('| Device | Pixel \\| Chrome |'), rich(sent[0])?.markdown);

  // A chat that won't take a rich message: the plain text, as before.
  sent.length = 0;
  const logsRich = [];
  const errorRich = console.error;
  console.error = (...a) => logsRich.push(a.join(' '));
  telegram = noRich(() => ({ status: 200, body: { ok: true, result: { message_id: 77 } } }));
  r = await call(handler, { body: REPORT });
  console.error = errorRich;
  const m = sent[1];
  ok('4. no rich message: 200, then Telegram\'s sendMessage', r.statusCode === 200 && sent[0]?.url.endsWith('/sendRichMessage') && m?.url === `https://api.telegram.org/bot${TOKEN}/sendMessage`, sent.map((x) => x.url).join());
  ok('4. the reason logged, never the token', logsRich.some((l) => l.includes('rich messages are not allowed') && l.includes('plain text')) && !logsRich.some((l) => l.includes(TOKEN)), logsRich.join(' | '));
  ok('4. to the chat set', m?.body.chat_id === CHAT);
  ok('4. as plain text: no parse_mode', m && !('parse_mode' in m.body));
  ok('4. no link previews', m?.body.link_preview_options?.is_disabled === true);
  const text = m?.body.text || '';
  ok('4. what was typed, as it was', text.includes(REPORT.text), JSON.stringify(text));
  ok('4. the app and its version', text.includes('App: Android app 1.0.1'));
  ok('4. the device, page and contact', text.includes(`Device: ${REPORT.device}`) && text.includes(`Page: ${REPORT.page}`) && text.includes('Contact: @someone'));
  ok('4. no token in the message', !text.includes(TOKEN));

  sent.length = 0;
  r = await call(handler, { body: { text: 'Only the words.\u0000\u0007 Bye' } });
  ok('4. with nothing else, it says so, control characters out', r.statusCode === 200 && /App: Unknown\n/.test(sent[1]?.body.text) && /Contact: none given/.test(sent[1]?.body.text) && /Only the words\. Bye$/.test(sent[1]?.body.text), JSON.stringify(sent[1]?.body.text));
  r = await call(handler, { body: { ...REPORT, platform: '<script>' } });
  ok('4. an unknown platform is Unknown', /App: Unknown 1\.0\.1/.test(sent.at(-1)?.body.text));
  telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });

  // A minute's limit, from one IP.
  sent.length = 0;
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await call(handler, { body: REPORT, ip: '10.9.9.9' })).statusCode);
  ok('5. two a minute from one IP, then 429', codes.join() === '200,200,429', codes.join());
  ok('5. the third not sent', sent.length === 2);
  // An hour's, from one IP (a different instance each minute, so only Redis counts).
  const hour = Math.floor(Date.now() / 3600000);
  counts.set(`uwucurrency:bug:${hour}:10.8.8.8`, 6);
  r = await call(handler, { body: REPORT, ip: '10.8.8.8' });
  ok('5. a seventh in the hour from one IP: 429', r.statusCode === 429);
  counts.set(`uwucurrency:bug:${hour}:all`, 60);
  r = await call(handler, { body: REPORT });
  ok('5. the sixty-first in the hour from anyone: 429', r.statusCode === 429);
  counts.clear();

  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, website: 'https://spam.example' } });
  ok('6. the bot\'s field filled in: 200, nothing sent', r.statusCode === 200 && sent.length === 0);

  const logs = [];
  const error = console.error;
  console.error = (...a) => logs.push(a.join(' '));
  telegram = () => ({ status: 400, body: { ok: false, description: 'Bad Request: chat not found' } });
  r = await call(handler, { body: REPORT });
  ok('7. Telegram refusing it, rich and plain: 502, try again', r.statusCode === 502 && /try again/.test(r.payload?.error) && sent.at(-2)?.url.endsWith('/sendRichMessage') && sent.at(-1)?.url.endsWith('/sendMessage'));
  telegram = () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); };
  r = await call(handler, { body: REPORT });
  ok('7. Telegram too slow: 502', r.statusCode === 502);
  console.error = error;
  ok('7. the reason logged, never the token', logs.some((l) => l.includes('chat not found')) && !logs.some((l) => l.includes(TOKEN)), logs.join(' | '));
  telegram = () => ({ status: 200, body: { ok: true } });

  // Several chats.
  const { chats } = handler;
  ok('9. read from commas, spaces and new lines', JSON.stringify(chats('424242, -1001234567890/17\n@uwucurrency_reports  -4012345678')) === JSON.stringify([
    { chat_id: '424242' }, { chat_id: '-1001234567890', message_thread_id: 17 }, { chat_id: '@uwucurrency_reports' }, { chat_id: '-4012345678' },
  ]), JSON.stringify(chats('424242, -1001234567890/17\n@uwucurrency_reports  -4012345678')));
  ok('9. what isn\'t a chat is left out', JSON.stringify(chats('abc, 12a, @x, /5, , 42')) === JSON.stringify([{ chat_id: '42' }]), JSON.stringify(chats('abc, 12a, @x, /5, , 42')));
  process.env.BUG_REPORT_CHAT_ID = 'nonsense';
  r = await call(handler, { body: REPORT });
  ok('9. no chat that reads as one: not set up, 503', r.statusCode === 503);
  process.env.BUG_REPORT_CHAT_ID = `${CHAT}, -1001234567890/17, @uwucurrency_reports`;
  sent.length = 0;
  r = await call(handler, { body: REPORT });
  ok('9. three chats: 200, three messages', r.statusCode === 200 && sent.length === 3, `${r.statusCode} ${sent.length}`);
  ok('9. each to its chat, the topic with its ID, the same words', sent[0]?.body.chat_id === CHAT && !('message_thread_id' in sent[0].body)
    && sent[1]?.body.chat_id === '-1001234567890' && sent[1].body.message_thread_id === '17'
    && sent[2]?.body.chat_id === '@uwucurrency_reports' && sent.every((x) => x.body.rich_message === sent[0].body.rich_message));
  logs.length = 0;
  console.error = (...a) => logs.push(a.join(' '));
  sent.length = 0;
  telegram = (opts) => (opts.body instanceof FormData ? opts.body.get('chat_id') : JSON.parse(opts.body).chat_id) === CHAT ? { status: 200, body: { ok: true } } : { status: 403, body: { ok: false, description: 'Forbidden: bot is not a member of the channel chat' } };
  r = await call(handler, { body: REPORT });
  ok('9. one took it, two didn\'t: still 200', r.statusCode === 200);
  ok('9. the two that didn\'t are logged by place, with the reason', logs.some((l) => l.includes('chat 2:') && l.includes('not a member')) && logs.some((l) => l.includes('chat 3:')) && !logs.some((l) => l.includes(TOKEN)), logs.join(' | '));
  ok('9. the one that took it got one message, the others a rich and a plain try each', sent.filter((x) => x.body.chat_id === CHAT).length === 1 && sent.filter((x) => x.body.chat_id !== CHAT).length === 4, sent.map((x) => `${x.body.chat_id}:${x.url.split('/').pop()}`).join());
  telegram = () => ({ status: 400, body: { ok: false, description: 'Bad Request: chat not found' } });
  r = await call(handler, { body: REPORT });
  ok('9. none took it: 502', r.statusCode === 502);
  console.error = error;
  telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });
  process.env.BUG_REPORT_CHAT_ID = CHAT;

  // 10. Pictures: in the rich message, uploaded with it.
  const jpeg = (kb) => `data:image/jpeg;base64,${Buffer.alloc(kb * 1024, 7).toString('base64')}`;
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(50)] } });
  let rr = rich(sent[0]);
  ok('10. one picture: 200, one rich message, nothing after it', r.statusCode === 200 && sent.length === 1 && sent[0].url.endsWith('/sendRichMessage'), sent.map((x) => x.url).join());
  ok('10. the picture uploaded with it, as p0', sent[0]?.body.p0?.file && sent[0].body.p0.type === 'image/jpeg' && JSON.stringify(rr?.media) === JSON.stringify([{ id: 'p0', media: { type: 'photo', media: 'attach://p0' } }]), JSON.stringify(rr?.media));
  ok('10. and shown in it, under Picture', /## Picture\n\n!\[\]\(tg:\/\/photo\?id=p0\)$/.test(rr?.markdown || ''), JSON.stringify(rr?.markdown));
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(40), jpeg(40), `data:image/png;base64,${Buffer.alloc(2048, 1).toString('base64')}`] } });
  rr = rich(sent[0]);
  ok('10. three: one rich message, three files, three picture blocks with captions', r.statusCode === 200 && sent.length === 1 && rr?.media?.length === 3 && sent[0].body.p2?.type === 'image/png'
    && ['p0', 'p1', 'p2'].every((id, i) => rr.markdown.includes(`![](tg://photo?id=${id} "Picture ${i + 1} of 3")`)) && rr.markdown.includes('## Pictures (3)'), JSON.stringify(rr));

  // Where a rich message won't go: after the plain message, replying to it.
  const quiet = console.error;
  console.error = () => {};
  telegram = noRich(() => ({ status: 200, body: { ok: true, result: { message_id: 77 } } }));
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(50)] } });
  sent.shift();
  ok('10. one picture: 200', r.statusCode === 200, `${r.statusCode} ${JSON.stringify(r.payload)}`);
  ok('10. no rich: the message says there are pictures', /Pictures: 1, below/.test(sent[0]?.body.text || ''), sent[0]?.body.text);
  ok('10. no rich: then sendPhoto, to the chat, replying to the message', sent[1]?.url.endsWith('/sendPhoto') && sent[1].body.chat_id === CHAT && JSON.parse(sent[1].body.reply_parameters).message_id === 77 && sent[1].body.photo?.file && sent[1].body.photo.type === 'image/jpeg', JSON.stringify(sent[1]?.body));
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(40), jpeg(40), `data:image/png;base64,${Buffer.alloc(2048, 1).toString('base64')}`] } });
  sent.shift();
  const album = sent[1];
  ok('10. no rich: three as an album of three, the first with a caption', r.statusCode === 200 && album?.url.endsWith('/sendMediaGroup') && JSON.parse(album.body.media).length === 3 && /3 pictures/.test(JSON.parse(album.body.media)[0].caption) && album.body.p2?.type === 'image/png', JSON.stringify(album?.body));
  console.error = quiet;
  telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });
  sent.length = 0;
  for (const [label, imgs] of [['four', [jpeg(1), jpeg(1), jpeg(1), jpeg(1)]], ['not an image', ['data:text/html;base64,PGI+']], ['too big', [jpeg(1300)]], ['not a list', 'x']]) {
    r = await call(handler, { body: { ...REPORT, images: imgs } });
    ok(`10. ${label}: 400`, r.statusCode === 400, `${r.statusCode} ${r.payload?.error || ''}`);
  }
  ok('10. nothing sent for any of them', sent.length === 0);
  const error2 = console.error;
  console.error = () => {};
  telegram = (o) => (o.body instanceof FormData ? { status: 400, body: { ok: false, description: 'Bad Request: photo too big' } } : { status: 200, body: { ok: true, result: { message_id: 78 } } });
  // (the rich message with the picture refused, then the plain one sent, its picture refused)
  r = await call(handler, { body: { ...REPORT, images: [jpeg(10)] } });
  ok('10. the pictures failing: the report still sent, 200', r.statusCode === 200);
  console.error = error2;
  // 11. Report IDs and whole-page screenshots.
  telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });
  const { reportId, fullShots } = handler;
  ok('11. an ID is the day in Singapore and four letters', reportId(new Date('2026-11-02T17:30:00Z'), () => [0, 1, 2, 30]) === '20261103-234Z', reportId(new Date('2026-11-02T17:30:00Z'), () => [0, 1, 2, 30]));
  const ids = new Set(Array.from({ length: 200 }, () => reportId()));
  ok('11. none of 0, O, 1, I or L, and 200 in a row all different', [...ids].every((x) => /^\d{8}-[2-9A-HJKMNP-Z]{4}$/.test(x)) && ids.size === 200);
  ok('11. full: only whole numbers in range, once each', JSON.stringify(fullShots([2, 0, 0, 5, -1, 1.5, '1'], 3)) === '[0,2]' && JSON.stringify(fullShots('x', 3)) === '[]');
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(30), jpeg(40)], full: [1] } });
  const doc = sent.find((x) => x.url.endsWith('/sendDocument'));
  ok('11. a whole-page shot: the rich message, then it again as a file', r.statusCode === 200 && sent.length === 2 && sent[0].url.endsWith('/sendRichMessage') && doc === sent[1], sent.map((x) => x.url.split('/').pop()).join());
  ok('11. the file replies to the report, named and captioned with its ID', JSON.parse(doc?.body.reply_parameters || '{}').message_id === 77
    && doc?.body.document?.name === `report-${r.payload.id}-page-2.jpg` && doc.body.caption.includes(r.payload.id) && doc.body.document.size === 40 * 1024, JSON.stringify(doc?.body));
  ok('11. the photo in the rich message is still there, both pictures', rich(sent[0])?.media?.length === 2);
  console.error = () => {};
  telegram = noRich(() => ({ status: 200, body: { ok: true, result: { message_id: 91 } } }));
  sent.length = 0;
  r = await call(handler, { body: { ...REPORT, images: [jpeg(30)], full: [0] } });
  ok('11. no rich: message, photo, then the file, each with the ID', r.statusCode === 200 && sent.map((x) => x.url.split('/').pop()).join() === 'sendRichMessage,sendMessage,sendPhoto,sendDocument'
    && sent[1].body.text.startsWith(`Bug report ${r.payload.id},`) && sent[2].body.caption.includes(r.payload.id) && JSON.parse(sent[3].body.reply_parameters).message_id === 91, sent.map((x) => x.url.split('/').pop()).join());
  telegram = (o) => (o.body instanceof FormData && o.body.has('document') ? { status: 400, body: { ok: false, description: 'Bad Request: file too big' } } : { status: 200, body: { ok: true, result: { message_id: 77 } } });
  r = await call(handler, { body: { ...REPORT, images: [jpeg(30)], full: [0] } });
  ok('11. the file failing: the report still sent, with its ID', r.statusCode === 200 && /^\d{8}-/.test(r.payload?.id || ''));
  console.error = error2;
  telegram = () => ({ status: 200, body: { ok: true, result: { message_id: 77 } } });
  return handler;
}

(async () => {
  await api();
  console.log(fails ? `${fails} failed` : 'all passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
