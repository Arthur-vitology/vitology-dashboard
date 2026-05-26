module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  if (!accessToken || !advertiserId) {
    return res.status(200).json({
      platform: 'TikTok', daily: [], spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, status: 'not_configured'
    });
  }
  const { from, to } = req.query;
  try {
    const resp = await fetch('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
      method: 'POST',
      headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        dimensions: ['stat_time_day'],
        metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc'],
        start_date: from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10),
        end_date: to || new Date().toISOString().slice(0,10),
        page_size: 100,
      }),
    });
    const data = await resp.json();
    if (data.code !== 0) return res.status(400).json({ error: data.message });
    const daily = (data.data?.list || []).map(row => ({
      date: row.dimensions.stat_time_day,
      spend: Math.round(parseFloat(row.metrics?.spend || 0) * 100) / 100,
      impressions: parseInt(row.metrics?.impressions || 0),
      clicks: parseInt(row.metrics?.clicks || 0),
    })).sort((a, b) => a.date.localeCompare(b.date));
    let spend = 0, impressions = 0, clicks = 0;
    daily.forEach(d => { spend += d.spend; impressions += d.impressions; clicks += d.clicks; });
    return res.status(200).json({
      platform: 'TikTok',
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
