/**
 * server.js — servidor de produção para o MRP Dashboard (SPA)
 *
 * Serve o build estático em dist/ com fallback para index.html em qualquer
 * rota não encontrada (necessário para React Router BrowserRouter).
 *
 * Usado no Render como start command: node server.js
 * Porta lida de process.env.PORT (Render injeta automaticamente).
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST  = join(__dirname, 'dist');
const PORT  = parseInt(process.env.PORT ?? '3000', 10);

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript',
  '.css':   'text/css',
  '.json':  'application/json',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain',
  '.map':   'application/json',
};

// Assets com hash no nome → imutáveis; HTML → sem cache
function cacheHeader(ext) {
  return ext === '.html' || ext === ''
    ? 'no-cache, no-store, must-revalidate'
    : 'public, max-age=31536000, immutable';
}

const server = createServer(async (req, res) => {
  try {
    const urlPath   = new URL(req.url ?? '/', 'http://localhost').pathname;
    const filePath  = join(DIST, urlPath);
    const isFile    = existsSync(filePath) && statSync(filePath).isFile();
    const target    = isFile ? filePath : join(DIST, 'index.html');
    const ext       = extname(target).toLowerCase();
    const data      = await readFile(target);

    res.writeHead(200, {
      'Content-Type':  MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': cacheHeader(ext),
    });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () =>
  console.log(`MRP Dashboard running on port ${PORT}`)
);
