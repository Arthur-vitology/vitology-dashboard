var SHEET_ID = '1TzW4vfiGwaxq9xA3AoTaEO0XW6d3z3AnAnI5AaBKkcc';
var SHEET_NAME = 'Meta';
var ACCESS_TOKEN = 'EAAei0OZAj9KQBSJ08YjZCg0yuVvWcYC1mgvkaQ3ZAIqVqNwrenauaGRvRZBIq6CL0MkHgvzkHalZBni4yegvRtLWuzGerwuUZCzYrvACizdZBLhFUSYjdW6u3nXIbM25WRKH9T0ulbIHBjlY0Gmp5BL7qcTQFAY52RuGjjTCeSwZAZAIcHBIyZCoPPZBIcnOP2ZCZAAZDZD';
var AD_ACCOUNT_ID = '1713113725906953';

function fetchMetaData() {
  if (!ACCESS_TOKEN || ACCESS_TOKEN === 'EAAei0OZAj9KQBSJ08YjZCg0yuVvWcYC1mgvkaQ3ZAIqVqNwrenauaGRvRZBIq6CL0MkHgvzkHalZBni4yegvRtLWuzGerwuUZCzYrvACizdZBLhFUSYjdW6u3nXIbM25WRKH9T0ulbIHBjlY0Gmp5BL7qcTQFAY52RuGjjTCeSwZAZAIcHBIyZCoPPZBIcnOP2ZCZAAZDZD') {
    Logger.log('ACCESS_TOKEN is niet ingesteld, sync overgeslagen.');
    return;
  }

  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  var startDate = new Date('2025-01-03');
  var today = new Date();
  var allRows = {};
  var hadError = false;

  var current = new Date(startDate);
  while (current <= today) {
    var blockEnd = new Date(current);
    blockEnd.setDate(blockEnd.getDate() + 89);
    if (blockEnd > today) blockEnd = new Date(today);

    var fromStr = Utilities.formatDate(current, 'Europe/Brussels', 'yyyy-MM-dd');
    var toStr = Utilities.formatDate(blockEnd, 'Europe/Brussels', 'yyyy-MM-dd');

    var filtering = encodeURIComponent(JSON.stringify([
      { field: 'campaign.effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }
    ]));
    var timeRange = encodeURIComponent(JSON.stringify({ since: fromStr, until: toStr }));

    var url = 'https://graph.facebook.com/v19.0/act_' + AD_ACCOUNT_ID + '/insights' +
      '?fields=spend,impressions,clicks' +
      '&time_range=' + timeRange +
      '&time_increment=1' +
      '&filtering=' + filtering +
      '&limit=500' +
      '&access_token=' + ACCESS_TOKEN;

    var options = {
      'method': 'GET',
      'muteHttpExceptions': true
    };

    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());

    if (data.error) {
      Logger.log('Fout voor periode ' + fromStr + ' - ' + toStr + ': ' + data.error.message);
      hadError = true;
    } else {
      var rows = data.data || [];
      rows.forEach(function (row) {
        var date = row.date_start;
        var spend = parseFloat(row.spend || 0);
        var impressions = parseInt(row.impressions || 0);
        var clicks = parseInt(row.clicks || 0);
        if (date) {
          if (!allRows[date]) allRows[date] = { spend: 0, impressions: 0, clicks: 0 };
          allRows[date].spend += spend;
          allRows[date].impressions += impressions;
          allRows[date].clicks += clicks;
        }
      });
      Logger.log('Periode ' + fromStr + ' - ' + toStr + ': ' + rows.length + ' rijen');
    }

    current.setDate(current.getDate() + 90);
    Utilities.sleep(500);
  }

  var dates = Object.keys(allRows).sort().reverse();

  if (dates.length === 0) {
    Logger.log('Geen data opgehaald (mogelijk verlopen ACCESS_TOKEN), sheet blijft ongewijzigd.');
    return;
  }

  sheet.clearContents();
  sheet.appendRow(['Datum', 'Spend', 'Impressies', 'Kliks']);
  dates.forEach(function (date) {
    var d = allRows[date];
    sheet.appendRow([date, Math.round(d.spend * 100) / 100, d.impressions, d.clicks]);
  });

  if (hadError) {
    Logger.log('Klaar met fouten: ' + dates.length + ' dagen opgehaald, sommige periodes gaven een fout (zie hierboven).');
  } else {
    Logger.log('Klaar: ' + dates.length + ' dagen opgehaald.');
  }
}

function setupMetaTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'fetchMetaData') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('fetchMetaData')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log('Meta trigger aangemaakt!');
}
