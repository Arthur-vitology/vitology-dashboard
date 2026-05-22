export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const devToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_CUSTOMER_ID;
  if (!devToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return res.status(500).json({ error: 'Google Ads credentials not configured', missing: {devToken:!!devToken,clientId:!!clientId,clientSecret:!!clientSecret,refreshToken:!!refreshToken,customerId:!!customerId} });
  }
  const { from, to } = req.query;
  const dateFrom = from ? from.slice(0,10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const dateTo = to ? to.slice(0,10) : new Date().toISOString().slice(0,10);
  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenText = await tokenResp.text();
    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch(e) { return res.status(400).json({ error: 'Token parse error', raw: tokenText.slice(0,200) }); }
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get Google access token', detail: tokenData });
    }
    const query = `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks FROM customer WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;
    const adsResp = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'developer-token': devToken,
          'login-customer-id': customerId,
          'Content-Type': '
