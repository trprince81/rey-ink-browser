export const runtime = 'nodejs';

// Rey Ink relay API: Vercel-compatible Node handler.
// Redis was intentionally removed from the request path because a dead Redis
// connection could leave serverless requests hanging for minutes.
const mem = globalThis.__reyInkDevicesV7 || (globalThis.__reyInkDevicesV7 = {
  devices: new Map(), commands: new Map(), results: new Map()
});

const key = (kind, slot) => `reyink:v7:${kind}:${slot}`;
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, no-cache, must-revalidate',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const online = d => !!d && Date.now() - Number(d.lastSeen || 0) < 30000;

function getHeader(req, name) {
  const h = req?.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(name);
  return h[name] ?? h[name.toLowerCase()] ?? null;
}

function getAction(req) {
  // Vercel's Node runtime can expose req.url as either an absolute or a
  // relative path. Always give URL() a base so '/api/rey-ink?...' is valid.
  try {
    return new URL(String(req?.url || '/'), 'https://rey-ink-browser.vercel.app').searchParams.get('action') || '';
  } catch {
    return '';
  }
}

function storageName() {
  return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? 'vercel-kv' : 'memory';
}

async function kv(command, args = []) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([command, ...args]),
      cache: 'no-store',
      signal: controller.signal
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function read(kind, slot) {
  const v = await kv('GET', [key(kind, slot)]);
  if (v !== null && v !== undefined) {
    try { return JSON.parse(v); } catch { return null; }
  }
  return mem[`${kind}s`]?.get(Number(slot)) || null;
}

async function write(kind, slot, value, ttl = 90) {
  const payload = JSON.stringify(value);
  const saved = await kv('SET', [key(kind, slot), payload, 'EX', ttl]);
  if (saved !== null || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) return;
  mem[`${kind}s`]?.set(Number(slot), value);
}

async function remove(kind, slot) {
  const result = await kv('DEL', [key(kind, slot)]);
  if (result !== null || (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) return;
  mem[`${kind}s`]?.delete(Number(slot));
}

async function devices() {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const d = await read('device', i);
    out.push({ pc_slot: i, is_online: online(d), last_seen: d?.lastSeen || null, state: d?.state || null });
  }
  return out;
}

export default async function handler(req) {
  try {
    if (req.method === 'OPTIONS') return json({ ok: true, service: 'rey-ink' });

    if (req.method === 'GET') {
      const action = getAction(req);
      // Health never touches storage. It must always return immediately.
      if (action === 'health' || !action) {
        return json({ ok: true, service: 'rey-ink', version: '7.0', storage: storageName(), time: Date.now() });
      }
      if (action === 'list_devices') {
        return json({ ok: true, devices: await devices(), storage: storageName() });
      }
      return json({ ok: false, error: 'Acción GET desconocida' }, 400);
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'JSON inválido' }, 400); }
    const action = String(body?.action || '').trim();

    if (action === 'health') return json({ ok: true, service: 'rey-ink', version: '7.0', storage: storageName(), time: Date.now() });
    if (action === 'list_devices') return json({ ok: true, devices: await devices(), storage: storageName() });

    const n = Number(body?.pc_slot);
    if (!Number.isInteger(n) || n < 1 || n > 20) return json({ ok: false, error: 'PC inválida' }, 400);

    if (action === 'register_device' || action === 'heartbeat') {
      const old = await read('device', n);
      const token = String(body?.token || old?.token || crypto.randomUUID());
      const device = {
        pc_slot: n,
        token,
        lastSeen: Date.now(),
        state: body?.state || old?.state || null
      };
      await write('device', n, device, 90);
      return json({ ok: true, pc_slot: n, token, is_online: true, storage: storageName() });
    }

    const device = await read('device', n);

    if (action === 'get_state') {
      return json({ ok: true, pc_slot: n, is_online: online(device), state: device?.state || null, storage: storageName() });
    }

    if (action === 'command') {
      if (!online(device)) return json({ ok: false, error: 'PC sin conexión' }, 409);
      if (body?.token && body.token !== device.token) return json({ ok: false, error: 'Token inválido' }, 401);
      const allowed = ['get_state','reload','back','forward','new_tab','close_tab','start_bot','stop_bot','navigate','click','type','tab_next','tab_prev','switch_tab','start_recording','stop_recording','run_routine'];
      const command = String(body?.command || '').toLowerCase().trim();
      if (!allowed.includes(command)) return json({ ok: false, error: 'Comando no permitido' }, 400);
      const id = crypto.randomUUID();
      await write('command', n, { id, command, payload: body?.payload || {}, createdAt: Date.now() }, 60);
      return json({ ok: true, command_id: id, command });
    }

    if (action === 'poll_command') {
      if (!device || body?.token !== device.token) return json({ ok: false, error: 'Token inválido' }, 401);
      device.lastSeen = Date.now();
      await write('device', n, device, 90);
      const command = await read('command', n);
      if (!command) return json({ ok: true, command: null });
      await remove('command', n);
      return json({ ok: true, command });
    }

    if (action === 'command_result') {
      if (!device || body?.token !== device.token) return json({ ok: false, error: 'Token inválido' }, 401);
      device.lastSeen = Date.now();
      await write('device', n, device, 90);
      await write('result', n, { ...(body?.result || {}), command_id: body?.command_id, receivedAt: Date.now() }, 300);
      return json({ ok: true });
    }

    if (action === 'last_result') return json({ ok: true, result: await read('result', n) });

    return json({ ok: false, error: 'Acción desconocida' }, 400);
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 500);
  }
}
