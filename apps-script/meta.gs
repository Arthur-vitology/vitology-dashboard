var SHEET_ID = '1TzW4vfiGwaxq9xA3AoTaEO0XW6d3z3AnAnI5AaBKkcc';
var SHEET_NAME = 'Meta';
var ACCESS_TOKEN = 'JOUW_META_ACCESS_TOKEN_HIER';
var AD_ACCOUNT_ID = 'JOUW_META_AD_ACCOUNT_ID_HIER';

function fetchMetaData() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  sheet.clearContents();
  sheet.appendRow(['Datum', 'Spend', 'Impressies', 'Kliks']);

  var startDate = new Date('2025-01-03');
  var today = new Date();
  var allRows = {};

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

    var url = 'https://graph.facebook.com/v19.0/act_' + AD_ACCOUNT_ID + '/insights' +
      '?fields=spend,impressions,clicks' +
      '&time_range={"since":"' + fromStr + '","until":"' + toStr + '"}' +
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
  dates.forEach(function (date) {
    var d = allRows[date];
    sheet.appendRow([date, Math.round(d.spend * 100) / 100, d.impressions, d.clicks]);
  });

  Logger.log('Klaar: ' + dates.length + ' dagen opgehaald.');
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
