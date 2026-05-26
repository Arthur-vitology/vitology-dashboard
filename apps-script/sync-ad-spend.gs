/**
 * Google Apps Script — Dagelijkse synchronisatie van Meta & TikTok advertentiekosten
 *
 * SETUP:
 * 1. Maak een Google Sheet met kolommen: Datum | Platform | Spend | Impressies | Kliks
 * 2. Open Extensions → Apps Script en plak deze code
 * 3. Pas VERCEL_BASE_URL aan naar je Vercel deployment URL
 * 4. Voer setupDailyTrigger() één keer handmatig uit om de dagelijkse trigger aan te maken
 * 5. Publiceer de sheet als CSV (Bestand → Delen → Publiceren naar het web → CSV)
 * 6. Kopieer de CSV-URL naar META_TIKTOK_ADS_CSV in index.html
 */

var VERCEL_BASE_URL = 'https://vitology-dashboard.vercel.app';
var SHEET_NAME = 'Blad1';

function syncYesterday() {
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var dateStr = Utilities.formatDate(yesterday, 'Europe/Brussels', 'yyyy-MM-dd');
  syncDate(dateStr);
}

function syncDate(dateStr) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  }

  var platforms = [
    { name: 'Meta', endpoint: '/api/meta' },
    { name: 'TikTok', endpoint: '/api/tiktok' },
  ];

  platforms.forEach(function (p) {
    try {
      var url = VERCEL_BASE_URL + p.endpoint + '?from=' + dateStr + '&to=' + dateStr;
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var data = JSON.parse(response.getContentText());

      if (data.error || data.status === 'not_configured') return;

      var daily = data.daily || [];
      if (daily.length === 0 && data.spend > 0) {
        daily = [{ date: dateStr, spend: data.spend, impressions: data.impressions || 0, clicks: data.clicks || 0 }];
      }

      daily.forEach(function (row) {
        removeExistingRow(sheet, row.date, p.name);
        sheet.appendRow([row.date, p.name, row.spend || 0, row.impressions || 0, row.clicks || 0]);
      });
    } catch (e) {
      Logger.log('Error syncing ' + p.name + ' for ' + dateStr + ': ' + e.message);
    }
  });

  sortSheet(sheet);
}

function removeExistingRow(sheet, date, platform) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'Europe/Brussels', 'yyyy-MM-dd');
    }
    if (String(rowDate) === String(date) && String(data[i][1]) === platform) {
      sheet.deleteRow(i + 1);
    }
  }
}

function sortSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  sheet.getRange(2, 1, lastRow - 1, 5).sort([{ column: 1, ascending: false }, { column: 2, ascending: true }]);
}

function backfillRange() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Backfill advertentiedata',
    'Vul een startdatum in (YYYY-MM-DD).\nData wordt opgehaald tot gisteren.',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var startDate = new Date(result.getResponseText());
  var endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);

  var current = new Date(startDate);
  while (current <= endDate) {
    var dateStr = Utilities.formatDate(current, 'Europe/Brussels', 'yyyy-MM-dd');
    syncDate(dateStr);
    current.setDate(current.getDate() + 1);
    Utilities.sleep(1000);
  }

  ui.alert('Backfill voltooid van ' + result.getResponseText() + ' tot gisteren.');
}

function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'syncYesterday') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('syncYesterday')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .nearMinute(0)
    .inTimezone('Europe/Brussels')
    .create();

  Logger.log('Dagelijkse trigger aangemaakt (06:00 Brussels)');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ad Sync')
    .addItem('Sync gisteren', 'syncYesterday')
    .addItem('Backfill...', 'backfillRange')
    .addItem('Setup dagelijkse trigger', 'setupDailyTrigger')
    .addToUi();
}
