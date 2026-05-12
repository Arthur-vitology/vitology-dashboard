export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  const { from, to } = req.query;
  const fromDate = from ? from.slice(0,10) : '2026-04-01';
  const toDate = to ? to.slice(0,10) : '2026-04-30';

  const fields = 'spend,impressions,clicks,ctr,cpc,account_name,account_currency';
  const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&level=account&time_range={"since":"${fromDate}","until":"${toDate}"}&access_token=${token}`;

  const response = await fetch(url);
  const data = await response.json();

  const urlCamp = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=spend,campaign_name&level=campaign&time_range={"since":"${fromDate}","until":"${toDate}"}&access_token=${token}`;
  const dataCamp = await (await fetch(urlCamp)).json();

  return res.status(200).json({
    account_level: data,
    campaign_level: dataCamp,
    url_used: url.replace(token, 'HIDDEN')
  });
}
