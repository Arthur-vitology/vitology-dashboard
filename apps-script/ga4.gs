/**
 * Google Apps Script — Dagelijkse synchronisatie van Google Analytics 4 website visits
 *
 * Schrijft per dag naar een GA4-tab in de sheet:
 * Kolommen: Datum | Sessions | Users | PageViews
 *
 * SETUP:
 * 1. Voeg een tab 'GA4' toe aan de centrale sheet (1TzW4...) met
 *    headers: Datum | Sessions | Users | PageViews
 * 2. Plak deze code als nieuw bestand `ga4.gs` in het bestaande
 *    "Vitology Google Ads data" Apps Script project
 * 3. Vul GA4_PROPERTY_ID hieronder in (te vinden in Google Analytics →
 *    Admin → Property Settings → "Property ID", bijv. "123456789")
 * 4. Schakel de "Google Analytics Data API" service in:
 *    Apps Script → Diensten (links) → "+" → "Google Analytics Data API"
 *    → versie v1beta → ID = AnalyticsData
 * 5. Run `fetchGA4Data` één keer handmatig om toestemming te geven
 * 6. Run `setupGA4Trigger` voor dagelijkse run om 06:00
 * 7. Publiceer de GA4 tab als CSV en kopieer de URL naar
 *    GA4_VISITS_CSV in index.html
 */

var SHEET_ID = '1TzW4vfiGwaxq9xA3AoTaEO0XW6d3z3AnAnI5AaBKkcc';
var SHEET_NAME = 'GA4';
var GA4_PROPERTY_ID = 'JOUW_GA4_PROPERTY_ID_HIER';

function fetchGA4Data() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  sheet.clearContents();
  sheet.appendRow(['Datum', 'Sessions', 'Users', 'PageViews']);

  var startDate = '2025-01-03';
  var endDate = Utilities.formatDate(new Date(), 'Europe/Brussels', 'yyyy-MM-dd');

  try {
    var request = {
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 10000
    };

    var response = AnalyticsData.Properties.runReport(request, 'properties/' + GA4_PROPERTY_ID);
    var rows = response.rows || [];

    rows.forEach(function (row) {
      var d = row.dimensionValues[0].value; // YYYYMMDD
      var formatted = d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
      var sessions = parseInt(row.metricValues[0].value || 0);
      var users = parseInt(row.metricValues[1].value || 0);
      var pageviews = parseInt(row.metricValues[2].value || 0);
      sheet.appendRow([formatted, sessions, users, pageviews]);
    });

    Logger.log('GA4 sync klaar: ' + rows.length + ' dagen');
  } catch (e) {
    Logger.log('GA4 sync fout: ' + e.message);
  }
}

function setupGA4Trigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'fetchGA4Data') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('fetchGA4Data')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  Logger.log('GA4 trigger aangemaakt!');
}
