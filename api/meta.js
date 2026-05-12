export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    return res.status(500).json({ error: 'Meta credentials not configured' });
  }

  const { from, to } = req.query;

  // Bouw de datumfilter correct op
  let dateParam = '';
  if (from && to) {
    // Verwijder uren van de datum
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    dateParam = `&time_range={"since":"${fromDate}","until":"${toDate}"}`;
  } else {
    // Standaard: huidige maand
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    dateParam = `&time_range={"since":"${firstDay}","until":"${today}"}`;
  }

  try {
    const fields = 'spend,impressions,clicks,ctr,cpc,reach,frequency';
    const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&level=account${dateParam}&access_token=${token}`;

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
