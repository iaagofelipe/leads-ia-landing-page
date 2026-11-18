import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  const relativePath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(OUTPUT_DIR, relativePath);

  if (!resolvedPath.startsWith(OUTPUT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado.');
    return;
  }

  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Arquivo não encontrado. Rode "npm run demo" ou "npm start" primeiro.');
    return;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(resolvedPath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Painel e previews disponíveis em: http://127.0.0.1:${PORT}`);
});
