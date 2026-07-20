/**
 * Google Apps Script — Dagelijkse synchronisatie van Google Analytics 4 data
 *
 * Twee tabs in de centrale sheet:
 * - GA4        (visits):  Datum | Sessions | Users | PageViews
 * - GA4 Events (funnel):  Datum | Event    | Count
 *
 * SETUP:
 * 1. Voeg beide tabs toe aan de centrale sheet (1TzW4...) met bovenstaande headers
 * 2. Plak deze code als `ga4.gs` in het bestaande Apps Script project
 * 3. Vul GA4_PROPERTY_ID hieronder in
 * 4. Schakel de "Google Analytics Data API" service in
 *    (Diensten → "+" → Google Analytics Data API v1beta, ID = AnalyticsData)
 * 5. Run `fetchGA4Data` handmatig — dit vult beide tabs
 * 6. Run `setupGA4Trigger` voor dagelijkse run om 06:00
 * 7. Publiceer beide tabs afzonderlijk als CSV en zet de URLs in index.html
 *    (GA4_VISITS_CSV en GA4_EVENTS_CSV)
 */

var SHEET_ID = '1TzW4vfiGwaxq9xA3AoTaEO0XW6d3z3AnAnI5AaBKkcc';
var VISITS_SHEET_NAME = 'GA4';
var EVENTS_SHEET_NAME = 'GA4 Events';
var GA4_PROPERTY_ID = 'JOUW_GA4_PROPERTY_ID_HIER';

var FUNNEL_EVENTS = [
  'battery_test_started',
  'battery_test_completed',
  'battery_test_score_calculated',
  'battery_test_email_submitted',
  'cta_clicked_battery_check',
  'afspraak_bevestigd_salonized'
];

function fetchGA4Data() {
  fetchGA4Visits();
  fetchGA4Events();
}

function fetchGA4Visits() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(VISITS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(VISITS_SHEET_NAME);

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
      var d = row.dimensionValues[0].value;
      var formatted = d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
      var sessions = parseInt(row.metricValues[0].value || 0);
      var users = parseInt(row.metricValues[1].value || 0);
      var pageviews = parseInt(row.metricValues[2].value || 0);
      sheet.appendRow([formatted, sessions, users, pageviews]);
    });

    Logger.log('GA4 visits sync klaar: ' + rows.length + ' dagen');
  } catch (e) {
    Logger.log('GA4 visits sync fout: ' + e.message);
  }
}

function fetchGA4Events() {
  var spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  var sheet = spreadsheet.getSheetByName(EVENTS_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(EVENTS_SHEET_NAME);

  sheet.clearContents();
  sheet.appendRow(['Datum', 'Event', 'Count']);

  var startDate = '2025-01-03';
  var endDate = Utilities.formatDate(new Date(), 'Europe/Brussels', 'yyyy-MM-dd');

  try {
    var request = {
      dateRanges: [{ startDate: startDate, endDate: endDate }],
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: FUNNEL_EVENTS }
        }
      },
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: true }],
      limit: 100000
    };

    var response = AnalyticsData.Properties.runReport(request, 'properties/' + GA4_PROPERTY_ID);
    var rows = response.rows || [];

    rows.forEach(function (row) {
      var d = row.dimensionValues[0].value;
      var formatted = d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
      var eventName = row.dimensionValues[1].value;
      var count = parseInt(row.metricValues[0].value || 0);
      sheet.appendRow([formatted, eventName, count]);
    });

    Logger.log('GA4 events sync klaar: ' + rows.length + ' rijen');
  } catch (e) {
    Logger.log('GA4 events sync fout: ' + e.message);
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
