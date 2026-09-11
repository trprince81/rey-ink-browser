import crypto from 'node:crypto';

const plans = {
  5: ['Especial 5', 13],
  10: ['Básico 10', 20],
  35: ['Pro 35', 30],
  50: ['Plus 50', 50],
  100: ['Business 100', 70],
  500: ['Enterprise 500', 150],
  1000: ['Max 1000', 350]
};
const durations = [1, 3, 6, 12];

function makeKey(email, profiles, months, expires) {
  const payload = JSON.stringify({ e: email, p: profiles, m: months, x: expires });
  const data = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHash('sha256').update(`MUTANT|${data}`).digest('hex').slice(0, 16).toUpperCase();
  return `MUT-${data}-${sig}`;
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

  try {
    const { email, profiles, duration_months } = req.body || {};
    const e = String(email || '').trim().toLowerCase();
    const p = Number(profiles);
    const d = Number(duration_months);

    if (!/^\S+@\S+\.\S+$/.test(e)) return res.status(400).json({ ok: false, error: 'Correo inválido' });
    if (!plans[p]) return res.status(400).json({ ok: false, error: 'Plan inválido' });
    if (!durations.includes(d)) return res.status(400).json({ ok: false, error: 'Duración inválida' });

    const [name, monthly] = plans[p];
    const start = new Date();
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + d);
    const expires = expiry.toISOString();
    const key = makeKey(e, p, d, expires);

    return res.status(200).json({
      ok: true,
      program: 'MUTANT',
      client: { email: e },
      license: {
        license_key: key,
        starts_at: start.toISOString(),
        expires_at: expires,
        duration_months: d,
        status: 'active'
      },
      plan: { name, max_profiles: p, monthly_price: monthly, total_price: monthly * d }
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}
