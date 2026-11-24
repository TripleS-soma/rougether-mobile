// 정적 내보내기 폴더를 서빙한다. 확장자 없는 경로(/login)는 login.html로, 없으면 index.html로 푼다.
// 확장자 있는 경로(/x.js)가 없으면 404 — 빠진 파일을 index.html로 덮어 가리지 않는다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = join(process.cwd(), process.argv[2] ?? 'web-build/app');
const port = Number(process.argv[3] ?? 6010);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
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
  const candidates = extname(clean)
    ? [base]
    : [base, `${base}.html`, join(base, 'index.html'), join(root, 'index.html')];
  for (const c of candidates) {
    if (c.startsWith(root + sep) && (await isFile(c))) return c;
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const file = await resolvePath(new URL(req.url ?? '/', 'http://x').pathname);
    if (!file) {
      res.writeHead(404).end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    // 잘못된 인코딩(%E0)·읽기 실패가 서버를 죽이지 않게 — 그 요청만 500.
    if (!res.headersSent) res.writeHead(500);
    res.end(`server error: ${e instanceof Error ? e.message : String(e)}`);
  }
}).listen(port, '127.0.0.1');
