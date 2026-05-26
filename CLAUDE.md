# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vitology Dashboard is a single-page analytics dashboard for Vitology, a health/wellness business with two locations (Antwerpen, Schilde). It has two tabs: a **Leads dashboard** (marketing funnel tracking) and a **Sales dashboard** (revenue/invoice analytics). The UI language is Dutch (nl-BE locale).

## Architecture

**No build system or package manager.** This is a static site — one `index.html` file (~900 lines) containing all HTML, CSS, and JavaScript inline. There are no npm dependencies, no bundler, and no framework.

### Data flow

- **Leads & Sales data**: Fetched at runtime from published Google Sheets CSVs (public URLs hardcoded in `index.html` as `LEADS_CSV`, `SALES_CSV`, `VITOLOGISTS_CSV`, `GOOGLE_ADS_CSV`). Parsed client-side with a custom `parseCSV()` function.
- **Ad platform APIs** (`api/` directory): Three Vercel serverless functions that proxy requests to Meta, Google Ads, and TikTok APIs. They read credentials from environment variables and return aggregated spend/impressions/clicks data. Google Ads spend is also loaded from a Google Sheet CSV for historical data.
- **Charts**: Chart.js 4.4.1 loaded from CDN. Two chart instances per tab (bar + doughnut).

### Key data model

- **Leads funnel stages**: Registratie → Contacted (Ja/F-Up/Lost/Nee) → Proefsessie → Show/No-show → Won (has `factuurdatum`)
- **Sales categories**: Vitologist, VitoQ, Losse sessies, Credit packs, Seminars, Producten/programma's, Andere — categorized by `categorizeSub()` which inspects subscription name and origin field.
- **Locations**: "Antwerpen" and "Schilde" for leads; "Vitology Antwerpen" and "Vitology Schilde" for sales (note the prefix difference). "Vitology Rotterdam" is filtered out.

### API serverless functions (`api/`)

| File | Platform | Auth method | Key env vars |
|------|----------|-------------|-------------|
| `google.js` | Google Ads | OAuth2 refresh token flow | `GOOGLE_DEVELOPER_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |
| `meta.js` | Meta/Facebook | Long-lived access token | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| `tiktok.js` | TikTok Ads | Access token | `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` |

All accept `?from=YYYY-MM-DD&to=YYYY-MM-DD` query params.

## Development

To run locally, serve the directory with any static file server:

```
npx serve .
# or
python3 -m http.server 8000
```

The API functions in `api/` are Vercel serverless functions (Node.js `module.exports` handlers with `(req, res)` signature). They only work when deployed to Vercel or run with `vercel dev`.

There are no tests, no linter, and no CI pipeline configured.

## Conventions

- All CSS uses short variable names defined in `:root` (e.g., `--bg`, `--surf`, `--bdr`, `--acc`).
- JavaScript function and variable names are heavily abbreviated (e.g., `pd` = parse date, `fmtD` = format date, `dlt` = delta, `aggLeads` = aggregate leads, `filtLeads` = filter leads).
- The drill-down tables use a year→quarter→month→week→day tree structure with toggle expand/collapse via `toggleDrill()`.
- Date parsing (`pd()`) handles multiple formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, and Excel serial numbers.
- Currency formatting uses nl-BE locale (`€` prefix, comma decimal separator).
