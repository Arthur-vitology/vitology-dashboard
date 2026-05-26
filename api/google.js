module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const devToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const customerId = '1507648056';
  const mccId = '7887429254';
  if (!devToken || !clientId || !clientSecret || !refreshToken) {
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
      }).toString(),
    });
    const tokenText = await tokenResp.text();
    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch(e) { return res.status(400).json({ error: 'Token parse error', raw: tokenText.slice(0,200) }); }
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get Google access token', detail: tokenData });
    }
    const query = `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;
    const adsResp = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'developer-token': devToken,
          'login-customer-id': mccId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );
    const adsText = await adsResp.text();
    let adsData;
    try { adsData = JSON.parse(adsText); } catch(e) { return res.status(400).json({ error: 'Ads parse error', raw: adsText.slice(0,500) }); }
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
