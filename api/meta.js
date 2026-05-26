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
    const fields = 'spend,impressions,clicks';
    const filtering = encodeURIComponent(JSON.stringify([
      {"field":"campaign.effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}
    ]));
    const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&time_range={"since":"${fromDate}","until":"${toDate}"}&time_increment=1&filtering=${filtering}&limit=500&access_token=${token}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const byDay = {};
    (data.data || []).forEach(row => {
      const d = row.date_start;
      if (!byDay[d]) byDay[d] = { date: d, spend: 0, impressions: 0, clicks: 0 };
      byDay[d].spend += parseFloat(row.spend || 0);
      byDay[d].impressions += parseInt(row.impressions || 0);
      byDay[d].clicks += parseInt(row.clicks || 0);
    });
    const daily = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    daily.forEach(d => { d.spend = Math.round(d.spend * 100) / 100; });
    let spend = 0, impressions = 0, clicks = 0;
    daily.forEach(d => { spend += d.spend; impressions += d.impressions; clicks += d.clicks; });
    return res.status(200).json({
      platform: 'Meta',
      daily,
      spend: Math.round(spend * 100) / 100,
      impressions, clicks,
      ctr: impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0,
      cpc: clicks > 0 ? Math.round(spend / clicks * 100) / 100 : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
