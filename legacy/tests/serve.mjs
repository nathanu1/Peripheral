// Optional development preview. The application itself needs only index.html.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://preview.invalid').pathname;
  if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (!['/', '/index.html'].includes(path)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const html = await readFile(new URL('../index.html', import.meta.url));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
  } catch {
    response.writeHead(500); response.end('Unable to read index.html');
  }
}).listen(port, '0.0.0.0', () => console.log(`Peripheral preview listening on ${port}`));
