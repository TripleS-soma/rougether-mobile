// 정적 내보내기 폴더를 서빙한다. 확장자 없는 경로(/login)는 login.html로, 없으면 index.html로 푼다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), process.argv[2] ?? 'web-build/app');
const port = Number(process.argv[3] ?? 6010);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const base = join(root, clean);
  const candidates = [base, `${base}.html`, join(base, 'index.html'), join(root, 'index.html')];
  for (const c of candidates) {
    if (c.startsWith(root) && (await isFile(c))) return c;
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolvePath(new URL(req.url ?? '/', 'http://x').pathname);
  if (!file) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(port, '127.0.0.1');
