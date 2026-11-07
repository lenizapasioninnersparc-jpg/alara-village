// Vercel serverless function: forwards page requests to Apps Script with a private secret.
// Needs two Environment Variables in Vercel: GAS_URL and VERCEL_API_SECRET.
const ALLOWED = new Set(['getViewingAvailability', 'submitViewingRequest']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (!body || typeof body !== 'object') throw new Error('Bad request');

    const fn = String(body.fn || '');
    const args = Array.isArray(body.args) ? body.args : [];
    if (!ALLOWED.has(fn)) return res.status(400).json({ ok: false, error: 'Not allowed' });
    if (JSON.stringify(args).length > 200000) return res.status(413).json({ ok: false, error: 'Too large' });

    const gasUrl = process.env.GAS_URL;
    const secret = process.env.VERCEL_API_SECRET;
    if (!gasUrl || !secret) return res.status(500).json({ ok: false, error: 'Server not configured' });

    const upstream = await fetch(gasUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'rpc', apiSecret: secret, fn, args })
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { return res.status(502).json({ ok: false, error: 'Bad response from Apps Script' }); }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Request failed' });
  }
};
