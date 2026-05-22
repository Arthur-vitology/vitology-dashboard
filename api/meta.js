module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    return res.status(500).json({ error: 'Meta credentials not configured' });
  }
  const { from, to } = req.query;
  const fromDate = from ? from.slice(0,10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const toDate = to ? to.slice(0,10) : new Date().toISOString().slice(0,10);
  try {
    const fields = 'spend,impressions,clicks,ctr,cpc';
    const filtering = encodeURIComponent(JSON.stringify([
      {"field":"campaign.effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}
    ]));
    const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&level=campaign&time_range={"since":"${fromDate}","until":"${toDate}"}&filtering=${filtering}&limit=100&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    let spend = 0, impressions = 0, clicks = 0;
    (data.data || []).forEach(c => {
      spend += parseFloat(c.spend || 0);
      impressions += parseInt(c.impressions || 0);
      clicks += parseInt(c.clicks || 0);
    });
    return res.status(200).json({
      platform: 'Meta',
      spend: Math.round(spend * 100) / 100,
      impressions, clicks,
      ctr: impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round(spend / clicks * 100) / 100 : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
