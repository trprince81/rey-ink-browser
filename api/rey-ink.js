// Rey Ink Browser transport API for Vercel.
// The browser extension polls this endpoint; the phone UI queues commands here.
// Note: Vercel functions are stateless. This in-memory transport is intentionally
// a wiring layer for the extension protocol; durable/shared state must be added
// before using multiple function instances as a production control plane.

const devices = globalThis.__reyInkDevices || (globalThis.__reyInkDevices = new Map());
const commands = globalThis.__reyInkCommands || (globalThis.__reyInkCommands = new Map());
const results = globalThis.__reyInkResults || (globalThis.__reyInkResults = new Map());

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-rey-ink-token'
  }
});

function tokenFor(device) {
  return device?.token || '';
}

function online(device) {
  return !!device && Date.now() - device.lastSeen < 30000;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST requerido' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'JSON inválido' }, 400); }

  const action = body.action;
  const slot = Number(body.pc_slot);
  const id = Number.isInteger(slot) && slot >= 1 && slot <= 20 ? slot : null;

  if (action === 'list_devices') {
    return json({
      ok: true,
      devices: Array.from({ length: 20 }, (_, i) => {
        const pc_slot = i + 1;
        const d = devices.get(pc_slot);
        return { pc_slot, is_online: online(d), last_seen: d?.lastSeen || null };
      })
    });
  }

  if (!id) return json({ ok: false, error: 'PC inválida' }, 400);

  if (action === 'register_device' || action === 'heartbeat') {
    if (!body.token) return json({ ok: false, error: 'Token de extensión requerido' }, 401);
    devices.set(id, { pc_slot: id, token: body.token, lastSeen: Date.now(), state: body.state || null });
    return json({ ok: true, pc_slot: id, is_online: true });
  }

  const device = devices.get(id);
  if (action === 'get_state') {
    return json({ ok: true, pc_slot: id, is_online: online(device), state: device?.state || null });
  }

  if (action === 'command') {
    if (!online(device)) return json({ ok: false, error: 'PC sin conexión' }, 409);
    const command = String(body.command || '').trim();
    const allowed = ['get_state', 'reload', 'back', 'forward', 'new_tab', 'start_bot', 'stop_bot'];
    if (!allowed.includes(command)) return json({ ok: false, error: 'Comando no permitido' }, 400);
    const commandId = crypto.randomUUID();
    commands.set(id, { id: commandId, command, createdAt: Date.now() });
    return json({ ok: true, command_id: commandId, command });
  }

  if (action === 'poll_command') {
    if (!body.token || body.token !== tokenFor(device)) return json({ ok: false, error: 'Token inválido' }, 401);
    device.lastSeen = Date.now();
    const command = commands.get(id);
    if (!command) return json({ ok: true, command: null });
    commands.delete(id);
    return json({ ok: true, command });
  }

  if (action === 'command_result') {
    if (!body.token || body.token !== tokenFor(device)) return json({ ok: false, error: 'Token inválido' }, 401);
    device.lastSeen = Date.now();
    results.set(id, { ...body.result, command_id: body.command_id, receivedAt: Date.now() });
    return json({ ok: true });
  }

  if (action === 'last_result') {
    return json({ ok: true, result: results.get(id) || null });
  }

  return json({ ok: false, error: 'Acción desconocida' }, 400);
}
