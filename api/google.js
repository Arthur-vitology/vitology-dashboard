export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const devToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_CUSTOMER_ID;
  if (!devToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return res.status(500).json({ error: 'Google Ads credentials not configured' });
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
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get Google access token' });
    }
    const query = `
      SELECT metrics.cost_micros, metrics.impressions, metrics.clicks
      FROM customer
      WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
    `;
    const adsResp = await fetch(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'developer-token': devToken,
          'login-customer-id': customerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      }
    );
    const adsData = await adsResp.json();
    if (adsData.error) return res.status(400).json({ error: adsData.error.message, detail: adsData });
    let spend = 0, impressions = 0, clicks = 0;
    (adsData.results || []).forEach(row => {
      spend += (row.metrics?.costMicros || 0) / 1_000_000;
      impressions += parseInt(row.metrics?.impressions || 0);
      clicks += parseInt(row.metrics?.clicks || 0);
    });
    return res.status(200).json({
      platform: 'Google Ads',
      spend: Math.round(spend * 100) / 100,
      impressions, clicks,
      ctr: impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round(spend / clicks * 100) / 100 : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
