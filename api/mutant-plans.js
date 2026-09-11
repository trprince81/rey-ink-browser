const plans = [
  { id: '5', name: 'Especial 5', max_profiles: 5, monthly_price: 13 },
  { id: '10', name: 'Básico 10', max_profiles: 10, monthly_price: 20 },
  { id: '35', name: 'Pro 35', max_profiles: 35, monthly_price: 30 },
  { id: '50', name: 'Plus 50', max_profiles: 50, monthly_price: 50 },
  { id: '100', name: 'Business 100', max_profiles: 100, monthly_price: 70 },
  { id: '500', name: 'Enterprise 500', max_profiles: 500, monthly_price: 150 },
  { id: '1000', name: 'Max 1000', max_profiles: 1000, monthly_price: 350 }
];

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });
  return res.status(200).json({ ok: true, program: 'MUTANT', durations: [1, 3, 6, 12], plans });
}
