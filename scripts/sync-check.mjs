// Two "devices" sync through a fake GitHub Gist API: progress made on one
// appears on the other, and both copies merge instead of overwriting.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  try { const b = readFileSync(join('dist', p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(4177);

const gists = new Map(); let n = 0; const calls = [];
async function fakeGitHub(route) {
  const req = route.request(), url = new URL(req.url()), m = req.method();
  calls.push(`${m} ${url.pathname}`);
  if (req.headers().authorization !== 'Bearer ghp_test') return route.fulfill({ status: 401, body: '{}' });
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
  if (url.pathname === '/user') return json({ login: 'tester' });
  if (url.pathname === '/gists' && m === 'GET') return json([...gists.values()]);
  if (url.pathname === '/gists' && m === 'POST') { const b = JSON.parse(req.postData()); const g = { id: 'g' + ++n, description: b.description, files: Object.fromEntries(Object.entries(b.files).map(([k, v]) => [k, { content: v.content }])) }; gists.set(g.id, g); return json(g, 201); }
  const id = url.pathname.split('/')[2], g = gists.get(id);
  if (!g) return json({}, 404);
  if (m === 'PATCH') { const b = JSON.parse(req.postData()); for (const [k, v] of Object.entries(b.files)) g.files[k] = { content: v.content }; return json(g); }
  return json(g);
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fails = []; const check = (ok, msg) => { console.log(ok ? 'ok  ' : 'FAIL', msg); if (!ok) fails.push(msg); };
async function device() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.route('https://api.github.com/**', fakeGitHub);
  await ctx.route('https://d8j0ntlcm91z4.cloudfront.net/**', (r) => r.fulfill({ status: 404 }));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  return { page, errors };
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('xinghan-course-v1') || 'null'));
async function connect(page, token = 'ghp_test') {
  await page.goto('http://localhost:4177/app/#/settings'); await page.waitForTimeout(600);
  await page.fill('input[type=password]', token); await page.click('form button.primary'); await page.waitForTimeout(1500);
}

// Device A: wrong token first, then the right one, then progress.
const A = await device();
await connect(A.page, 'ghp_wrong');
check(await A.page.locator('text=Ключ не подходит').count() > 0, 'wrong token shows a clear error');
await A.page.click('text=Отключить').catch(() => {});
await connect(A.page);
check(await A.page.locator('text=GitHub: tester').count() > 0, 'device A connected');
await A.page.goto('http://localhost:4177/app/#/lesson/jc1a-1/8'); await A.page.waitForTimeout(800);   // adds 12 cards
await A.page.goto('http://localhost:4177/app/#/'); await A.page.waitForTimeout(5500);                // wait for upload
const g = [...gists.values()][0];
const up = g && JSON.parse(g.files['baikun-progress.json'].content);
check(up && Object.keys(up.course.cards).length === 12, `gist holds A's 12 cards (${up && Object.keys(up.course.cards).length})`);

// Device B: has its own progress in starter lesson, connects, gets A's cards and keeps its own.
const B = await device();
await B.page.goto('http://localhost:4177/app/#/lesson/starter-1/8'); await B.page.waitForTimeout(800);  // 14 own cards
await connect(B.page);
await B.page.waitForTimeout(800);
const sb = await stored(B.page);
check(sb && Object.keys(sb.cards).length === 23, `device B merged: ${sb && Object.keys(sb.cards).length} cards (12 + 14 − 3 shared)`);
await B.page.waitForTimeout(5000);
const after = JSON.parse([...gists.values()][0].files['baikun-progress.json'].content);
check(Object.keys(after.course.cards).length === 23, 'merged copy uploaded back');
check(gists.size === 1, 'single gist reused across devices');

// Device A reloads: picks up B's cards.
await A.page.reload(); await A.page.waitForTimeout(2500);
const sa = await stored(A.page);
check(sa && Object.keys(sa.cards).length === 23, `device A pulled merged deck (${sa && Object.keys(sa.cards).length})`);
check(!A.errors.length && !B.errors.length, 'no page errors ' + [...A.errors, ...B.errors].join(' | '));
await A.page.goto('http://localhost:4177/app/#/settings'); await A.page.waitForTimeout(500);
await A.page.click('text=📱 Подключить другое устройство'); await A.page.waitForTimeout(300);
check((await A.page.inputValue('.share-key input')).startsWith('ghp_'), 'share shows the token');
await A.page.screenshot({ path: 'shots/sync-settings.png', fullPage: true });
await b.close(); server.close();
console.log(fails.length ? `${fails.length} FAILED` : 'sync ok');
process.exit(fails.length ? 1 : 0);
