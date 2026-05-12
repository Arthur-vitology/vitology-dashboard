export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    return res.status(500).json({ error: 'Meta credentials not configured' });
  }
  const { from, to } = req.query;
  const dateRange = from && to
    ? `&time_range={"since":"${from}","until":"${to}"}`
    : `&date_preset=maximum`;
  try {
    const fields = 'spend,impressions,clicks,ctr,cpc,reach,frequency';
    const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&level=account${dateRange}&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const d = data.data?.[0] || {};
    return res.status(200).json({
      platform: 'Meta',
      spend: parseFloat(d.spend || 0),
      impressions: parseInt(d.impressions || 0),
      clicks: parseInt(d.clicks || 0),
      ctr: parseFloat(d.ctr || 0),
      cpc: parseFloat(d.cpc || 0),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
