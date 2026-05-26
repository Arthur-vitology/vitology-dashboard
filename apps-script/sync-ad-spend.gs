/**
 * Google Apps Script — Dagelijkse synchronisatie van Meta & TikTok advertentiekosten
 *
 * Elke platform heeft zijn eigen Google Sheet (zoals Google Ads).
 * Kolommen per sheet: Datum | Spend | Impressies | Kliks
 *
 * SETUP:
 * 1. Maak 2 Google Sheets: eentje voor Meta, eentje voor TikTok
 *    Kolommen in elk: Datum | Spend | Impressies | Kliks
 * 2. Open Extensions > Apps Script in EEN van de sheets en plak deze code
 *    (het script schrijft naar beide sheets via hun ID)
 * 3. Vul VERCEL_BASE_URL, META_SHEET_ID en TIKTOK_SHEET_ID hieronder in
 * 4. Voer setupDailyTrigger() eenmaal uit via het Ad Sync menu
 * 5. Publiceer beide sheets als CSV (Bestand > Delen > Publiceren naar het web)
 * 6. Kopieer de CSV-URLs naar META_ADS_CSV en TIKTOK_ADS_CSV in index.html
 */

var VERCEL_BASE_URL = 'https://vitology-dashboard.vercel.app';
var META_SHEET_ID = '';
var TIKTOK_SHEET_ID = '';

var PLATFORMS = [
  { name: 'Meta', endpoint: '/api/meta', sheetId: function () { return META_SHEET_ID; } },
  { name: 'TikTok', endpoint: '/api/tiktok', sheetId: function () { return TIKTOK_SHEET_ID; } },
];

function getSheet(sheetId) {
  if (!sheetId) return null;
  var ss = SpreadsheetApp.openById(sheetId);
  return ss.getSheets()[0];
}

function syncYesterday() {
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var dateStr = Utilities.formatDate(yesterday, 'Europe/Brussels', 'yyyy-MM-dd');
  syncDate(dateStr);
}

function syncDate(dateStr) {
  PLATFORMS.forEach(function (p) {
    var sheet = getSheet(p.sheetId());
    if (!sheet) {
      Logger.log('Geen sheet ID voor ' + p.name + ', overgeslagen.');
      return;
    }
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
        removeExistingRow(sheet, row.date);
        sheet.appendRow([row.date, row.spend || 0, row.impressions || 0, row.clicks || 0]);
      });

      sortSheet(sheet);
    } catch (e) {
      Logger.log('Error syncing ' + p.name + ' for ' + dateStr + ': ' + e.message);
    }
  });
}

function removeExistingRow(sheet, date) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][0];
    if (rowDate instanceof Date) {
      rowDate = Utilities.formatDate(rowDate, 'Europe/Brussels', 'yyyy-MM-dd');
    }
    if (String(rowDate) === String(date)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function sortSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  sheet.getRange(2, 1, lastRow - 1, 4).sort({ column: 1, ascending: false });
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
