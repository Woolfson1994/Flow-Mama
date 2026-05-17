/**
 * Flow's Mama — Dev Server
 * Serves static files + handles POST /api/order
 *
 * NOTE: For production, use a real payment processor (Stripe, iCredit, Cardcom).
 * This server never stores card data — orders only contain shipping/contact info.
 */

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const ORDERS_FILE = join(PROJECT_ROOT, 'orders.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.mjs':  'text/javascript',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

async function ensureOrdersFile() {
  try {
    await readFile(ORDERS_FILE);
  } catch {
    await writeFile(ORDERS_FILE, '[]', 'utf8');
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function handleOrderPost(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const required = ['name', 'phone', 'email', 'deliveryType', 'color', 'size'];
  const missing = required.filter(k => !data[k]?.trim?.());
  if (missing.length) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'שדות חסרים', missing }));
    return;
  }

  if (data.deliveryType === 'shipping') {
    const shippingRequired = ['address', 'city', 'postal'];
    const missingShipping = shippingRequired.filter(k => !data[k]?.trim?.());
    if (missingShipping.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'שדות משלוח חסרים', missing: missingShipping }));
      return;
    }
  }

  if (data.deliveryType === 'pickup' && !data.pickupLocation?.trim?.()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'יש לבחור מיקום איסוף' }));
    return;
  }

  const order = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    deliveryType: data.deliveryType,
    ...(data.deliveryType === 'shipping' ? {
      address: data.address.trim(),
      city: data.city.trim(),
      postal: data.postal.trim(),
    } : {
      pickupLocation: data.pickupLocation.trim(),
    }),
    color: data.color,
    size: data.size,
    totalPrice: data.deliveryType === 'shipping' ? 270 : 250,
    status: 'pending',
  };

  const existing = JSON.parse(await readFile(ORDERS_FILE, 'utf8'));
  existing.push(order);
  await writeFile(ORDERS_FILE, JSON.stringify(existing, null, 2), 'utf8');

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, orderId: order.id }));
}

async function handleStaticFile(req, res) {
  let urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = resolve(join(PROJECT_ROOT, urlPath));
  if (!filePath.startsWith(PROJECT_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
    } else {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/order') {
    await handleOrderPost(req, res);
  } else {
    await handleStaticFile(req, res);
  }
});

await ensureOrdersFile();
server.listen(PORT, () => {
  console.log(`Flow's Mama running at http://localhost:${PORT}`);
});
