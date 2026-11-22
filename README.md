# FloodIQ: Oilfield Intelligence Platform

Datathon project: a dashboard for exploring oil and gas wells, water injection and well-conversion opportunities. It reads the team's tables exported from Databricks as CSV files (default), or the live Unity Catalog tables.

## Repository layout

```
wells.csv                       # exported bushra_well_master (2,905 wells)
performance.csv                 # exported bushra_well_performance (988 wells, Good/Moderate/Low)
conversion_ranking.csv          # exported bushra_conversion_ranking (328 candidates)
conversion_economics.csv        # exported bushra_conversion_economics (50 rows)
daily_production.parquet        # 5,075,590 daily rows, 2,905 wells (Git LFS)
well_jobs.parquet               # 15,610 maintenance job records
production_failures.parquet     # 2,873 equipment failures
scripts/build_wells_geojson.py  # parquet -> local well snapshot (fallback for the map)
backend/                        # Node + Express + TypeScript API -> CSV files or Databricks SQL Statement Execution API
web/                            # React + TypeScript + Tailwind + Mapbox frontend
```

## Quick start

You need two terminals.

```bash
# 1. Backend: reads the CSV files in the project root by default; no credentials needed
cd backend
cp .env.example .env        # optional: DATA_SOURCE=csv (default) or databricks
npm install
npm run dev                 # http://localhost:3001
```

```bash
# 2. Frontend
cd web
cp .env.example .env.local  # paste your Mapbox public token (pk.…)
npm install
npm run dev                 # http://localhost:5173 (proxies /api -> :3001)
```

Behaviour when pieces are missing:

- **A CSV file missing:** endpoints that need it return `503 DATA_FILE_MISSING`; the page says which file.
- **Backend down or not configured:** the Well Explorer falls back to the local parquet snapshot (`web/public/data/wells.geojson`) and says so. Databricks-only sections show a "not connected" state with a retry button.
- **No Mapbox token:** the maps show a "token required" notice. Everything else still works.

### Environment variables (`backend/.env`, gitignored)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATA_SOURCE` | no | `csv` (default) or `databricks` |
| `CSV_DATA_DIR` | no | Folder with the CSV files, relative to `backend/`. Default `..` (the project root) |
| `DATABRICKS_HOST` | databricks only | e.g. `https://dbc-xxxx.cloud.databricks.com` |
| `DATABRICKS_WAREHOUSE_ID` | databricks only | SQL Warehouse → Connection details |
| `DATABRICKS_TOKEN` | databricks only | PAT for authorized local development; use an OAuth service principal for shared deployments |
| `DATABRICKS_CATALOG` / `DATABRICKS_SCHEMA` | no | default `workspace` / `default` |
| `PORT` | no | default `3001` |
| `FRONTEND_ORIGIN` | no | CORS allowlist, comma-separated; default `http://localhost:5173` |
| `CACHE_TTL_SECONDS` | no | default `600` |
| `QUERY_TIMEOUT_SECONDS` | no | default `120` |

The token is never sent to the browser, never included in API responses or logs, and `.env` files are gitignored. The frontend only knows `VITE_MAPBOX_TOKEN`, `VITE_API_URL` and `VITE_WELLS_URL`.

## Data sources

Routes only talk to a `DataSource` (`backend/src/data/source.ts`). Both implementations return the same response shapes, so the frontend works unchanged with either.

**CSV (default).** `data/csv/` reads the exported files:

| File | Catalog table | Notes |
| --- | --- | --- |
| `wells.csv` | `bushra_well_master` | `uwi, well_name, area, lat, lon, on_production_date, total_oil_m3, total_inj_m3, first_injection_date, is_injector, is_producer` |
| `performance.csv` | `bushra_well_performance` | one row per well for week 2026-10-26; `performance_class` is Good / Moderate / Low |
| `conversion_ranking.csv` | `bushra_conversion_ranking` | `candidate` is the UWI; `rank` follows `oil_per_m3_water` descending |
| `conversion_economics.csv` | `bushra_conversion_economics` | expected / P10 / P90 profit, chance of profit, breakeven; no scenario column |
| — | `bushra_injector_producer_pairs` | **not exported**: the endpoint returns `404 DATASET_NOT_AVAILABLE` |
| — | `bushra_producer_features_latest` | **not exported**: `producerFeatures` is `null` in well detail |

- **Parsing:** RFC 4180 (quotes, escaped quotes, CRLF). Column types are inferred from the data (BOOLEAN, BIGINT, DOUBLE, DATE, STRING).
  - `null`, empty, `NaN`, `None` and `NA` become `null`.
  - Numbers with leading zeros stay strings, so IDs keep their zeros.
  - Lines with the wrong number of fields are skipped and reported.
- **Caching:** files are read only, never written. Each is parsed once and re-parsed when its modification time changes.
- **Duplicates:** one row per UWI (latest `week` for performance, first row for wells). Counts are in `metadata.duplicates`; the current exports have none.
- **Well type:** `wells.csv` has no current status or flow-direction column, so the type comes from `is_producer` / `is_injector`:
  - producer only → production (1,345 wells);
  - injector only → injection (563);
  - both → dual-role (51). These are shown as injection because in every one of them `first_injection_date` is later than `on_production_date`;
  - neither → unclassified (946).
  - The API includes a warning that says this.
- **Coordinates:** 8 wells have no `lat`/`lon` and are left off the map (counted in `metadata.excluded`).

**Databricks.** Set `DATA_SOURCE=databricks` and the `DATABRICKS_*` variables. This is the SQL Statement Execution API path described below. Column names verified from the CSVs (`candidate`, `on_production_date`, `first_injection_date`, `total_inj_m3`, `week`, `oil_per_m3_water`) are included in the field candidates, so the live tables should resolve the same way.

## Backend design (`backend/src`)

| Path | Purpose |
| --- | --- |
| `data/source.ts` | `DataSource` interface (the swap point between CSV and Databricks) |
| `data/csv/` | CSV parser, in-memory filter/sort/paging (same rules as the SQL reader), `CsvDataSource` |
| `data/databricksSource.ts` | Adapter over the Databricks repositories |
| `data/querySpecs.ts` | Per-endpoint filters, search fields and default sort, shared by both sources |
| `config/env.ts` | zod-validated config; flags missing or placeholder credentials |
| `services/databricks.ts` | Statement Execution API client: submit → poll → cancel on timeout → follow `next_chunk_internal_link` → column arrays to typed JSON objects |
| `services/cache.ts` | TTL cache with in-flight de-duplication (failures are never cached) |
| `services/modelServing.ts` | Interface boundary for a future Model Serving endpoint (currently "not connected") |
| `repositories/catalog.ts` | Table allowlist and **schema-verified column resolution** (see below) |
| `repositories/wells.ts` | Master + performance join, de-duplicated per UWI, role classification |
| `repositories/tableQuery.ts` | Paginated, parameterized reads with allowlisted sort columns |
| `repositories/analytics.ts` | Performance summary, pairs, ranking, economics, overview aggregates |
| `routes/*` | One router per endpoint group; `middleware/` has the error handler and request logging |

**Safety**

- The client only accepts `SELECT`, `WITH`, `DESCRIBE` and `SHOW`, and rejects stacked statements.
- Table names come from a fixed allowlist.
- Sort columns must exist in the table's `DESCRIBE` output, and direction is `asc` or `desc` only.
- Every user-provided value is bound as a named `:parameter`, and LIKE wildcards in search terms are escaped.
- Nothing writes to the Catalog or to the CSV files.
- Other protections: restricted CORS, rate limiting (300 requests per minute per IP), and 32 kB JSON bodies.
- Request logs record only method, path, status and duration: no query strings, headers or tokens.

**Column names are verified, not assumed** (Databricks path; the CSV path resolves fields against each file's header the same way).

- The exact columns of Bushra's tables couldn't be inspected while building this (no credentials were available).
- For each logical field (UWI, latitude, performance class, rank…) the backend runs `DESCRIBE TABLE` and maps the field to the first candidate column that actually exists.
- Unmatched fields come back as `null`, and are listed by `GET /api/meta/schema` and `npm run inspect`.
- After inspecting, pin exact names in `COLUMN_OVERRIDES` in `repositories/catalog.ts`.

**Duplicates.**

- Master and performance rows are each reduced to one row per UWI *before* the join, using `ROW_NUMBER() OVER (PARTITION BY uwi ORDER BY <date column> DESC)`.
- `metadata.duplicates` reports how many wells had more than one row, and how the kept row was chosen.

**Well roles are not mutually exclusive.**

- `wellType` is the *current* role, from flow direction, then status, then a well-type column.
- `roles.hasProducedHistorically` and `roles.hasInjectedHistorically` come from explicit flag columns or cumulative totals.
- `roles.dualRole` marks wells with evidence of both.
- On the map, dual-role wells are filled with their current role's colour and ringed in the other role's colour.

## API

All responses are JSON. Errors have the shape `{ "error": { "code", "message", "details?", "requestId" } }`.

| Endpoint | Query params | Notes |
| --- | --- | --- |
| `GET /api/health` | `deep=1` | Active `dataSource` and per-table availability. `deep=1` parses each CSV, or for Databricks runs `SELECT 1` and checks each table |
| `GET /api/wells` | `area`, `province`, `type` (`injection`/`production`/`unknown`/`dual`), `performance`, `search` | GeoJSON FeatureCollection, one feature per UWI, `[lng, lat]` |
| `GET /api/wells/:uwi` | | Master attributes, performance rows, pairs, ranking, economics. 404 if unknown |
| `GET /api/performance` | `class`, `area`, `search`, `limit`, `offset`, `sort`, `dir` | `summary` (SQL `GROUP BY` of the existing classes) plus a page of rows |
| `GET /api/injector-producer-pairs` | `uwi`, `injector`, `producer`, `area`, `maxDistance`, paging | Proximity disclaimer included. CSV mode: `404 DATASET_NOT_AVAILABLE` |
| `GET /api/conversion-ranking` | `area`, `search`, `minScore`, paging, `sort`, `dir` | Saved ranking, passed through as-is |
| `GET /api/conversion-economics` | `scenario`, `uwi`, `search`, paging | Rows plus distinct `scenarios`, with an estimate disclaimer |
| `GET /api/overview` | | Overview KPIs |
| `GET /api/analytics` | | Analytics page dataset: every unique well with its history roles, totals and latest performance row, the saved candidates joined to economics, and metric labels and units (gzipped, about 130 kB). CSV source only; Databricks returns 501 |
| `GET /api/meta/schema` | | Columns and field resolution per table (no data) |
| `GET /api/simulation/status`, `POST /api/simulation/run` | | Live inference boundary. `run` returns **501** until a Model Serving endpoint exists |

Paging defaults are `limit=50` (max 500) and `offset=0`.

### Response examples

These show the response *shape*. Column names inside `metrics` and `rows` are the real Databricks column names, so they will differ from the ones shown here.

```jsonc
// GET /api/health
{ "status": "ok", "service": "floodiq-api", "version": "0.2.0",
  "dataSource": { "kind": "csv", "ok": true, "tables": {
    "bushra_well_master": { "available": true, "source": "wells.csv" },
    "bushra_injector_producer_pairs": { "available": false, "error": "not included in the CSV export" } } },
  "databricks": { "configured": false, "missing": ["DATABRICKS_HOST", "DATABRICKS_WAREHOUSE_ID", "DATABRICKS_TOKEN"], "catalog": "workspace", "schema": "default" },
  "cache": { "entries": 0, "inflight": 0 } }

// GET /api/wells?type=dual   (numbers illustrative)
{ "type": "FeatureCollection",
  "metadata": { "source": "databricks", "tables": ["bushra_well_master", "bushra_well_performance"], "total": 2897, "returned": 66,
                "excluded": { "invalidCoordinates": 8 },
                "duplicates": { "masterWellsWithMultipleRows": 0, "performanceWellsWithMultipleRows": 0, "dedupeOrder": { "master": "…", "performance": "…" } },
                "performanceClasses": ["Good", "Moderate", "Low"], "warnings": [], "cached": true },
  "features": [{ "type": "Feature", "id": 1, "geometry": { "type": "Point", "coordinates": [-109.6, 52.4] },
    "properties": { "uwi": "…", "wellName": "…", "operatingArea": "…", "province": "SK", "wellType": "production", "status": "Producing",
      "roles": { "currentRole": "production", "hasProducedHistorically": true, "hasInjectedHistorically": true, "dualRole": true },
      "performanceClass": "Low", "metrics": { "<performance column>": 123.4 } } }] }

// GET /api/conversion-ranking?limit=2
{ "table": "bushra_conversion_ranking", "columns": [{ "name": "…", "type": "DOUBLE" }], "fields": { "uwi": "…", "rank": "…" },
  "rows": [{ "…": "…" }], "page": { "limit": 2, "offset": 0, "total": 0 }, "sort": { "column": "rank", "dir": "asc" },
  "notice": "Rankings and economics are model-generated estimates saved in Databricks. They are not live inference and not verified realized savings or profits." }

// Databricks not configured (any data endpoint)
{ "error": { "code": "DATABRICKS_NOT_CONFIGURED", "message": "Databricks is not configured on the server. Set the DATABRICKS_* variables in backend/.env.", "requestId": "1a2b3c4d" } }
```

## Verifying the connection

CSV mode: `curl 'localhost:3001/api/health?deep=1'` lists each file with its row count; the Well Explorer says **Loaded from the local CSV export**.

Databricks mode:

1. Run `npm run inspect` in `backend/`. It authenticates and then works through each table:
   - It runs `SELECT 1`, then `DESCRIBE`s every table.
   - It samples 10 rows from each table and compares row count with distinct UWIs (the duplicate check).
   - It checks how many wells have valid coordinates.
   - It writes `backend/schema-report.json` (gitignored, because it contains sample rows).
2. Run `npm run dev`, then `curl localhost:3001/api/health?deep=1` and `curl localhost:3001/api/meta/schema`.
3. Run `curl 'localhost:3001/api/wells' | jq '.metadata'`. Check `total`, `excluded` and `duplicates`.
4. Open the app. The Well Explorer should say **Live from Databricks**.

Tests: `npm test` in `backend/` runs 47 tests.

- **CSV tests** use fixture files in a temporary folder. They cover parsing, type inference, null tokens, duplicates, dual-role classification, filters, sorting with nulls last, the unexported-table response, reloading and missing files, and that the CSV files are never written.
- **Databricks tests** use a mocked warehouse and mocked `fetch`. They cover polling, chunking, failure, cancel and timeout, auth errors, type normalization, parameter binding, sort allowlisting, de-duplication, dual-role classification, filters, 404 and 400 responses, CORS, and the 501 inference boundary.

## Analytics page

`web/src/pages/AnalyticsPage.tsx` loads `GET /api/analytics` once and filters it in the browser (`web/src/lib/analyticsData.ts`), so every KPI, chart and table uses the same rows.

- **Filters:** operating area, well type (history), performance class, UWI or name search, and reset. They are kept in the URL.
- **KPIs:**
  - unique wells: one per UWI, so dual-role wells count once;
  - injection wells: wells that have injected;
  - production wells: wells that have produced;
  - low-performing wells.
- **Performance:** class donut; per-area chart with Count, Share and Oil rate (median) views; sortable metrics table.
- **Injection and production:**
  - role mix by area;
  - a scatter of nearby active injectors vs 13-week oil rate per well, or cumulative injection vs oil per area.
  - Both are labelled as association only.
- **Conversion:**
  - top 10 by saved rank;
  - P10 / expected / P90 projected profit;
  - candidate table;
  - a detail panel for the selected candidate.
  - All are labelled as model estimates and hypothetical projections.

**Units, checked against `daily_production.parquet`:**

- `oil_rate_13w` is the 13-week average daily oil rate (m³/d).
- `total_oil_m3` and `total_inj_m3` are cumulative totals over the export period.

**Performance classes are relative within each area:** Low is below the 1/3 area percentile, Moderate is 1/3–2/3, and Good is 2/3 and above. So the Oil rate view is the absolute comparison across areas.

**Not plotted:** there are no time-series charts, because no dated series is served.

## Local snapshot (fallback) data

`scripts/build_wells_geojson.py` builds one feature per UWI from `daily_production.parquet` (requires duckdb).

- **Current type:** the latest `flow_direction`, otherwise the latest `well_daily_status`.
- **Historical roles:** whether the well ever produced (oil > 0 or a production flow direction) and ever injected (injected volume > 0 or an injection flow direction). 66 wells have both.
- **Missing values:** stay missing, shown as "Not recorded". Nothing is imputed.

## Not yet done

- **Injector–producer pairs and producer features:** not in the CSV export, so these sections say "not included" and show no values.
- **Live Databricks verification:** no credentials were available while building, so the connection, the real column names, uniqueness per UWI and coordinate validity haven't been checked against the workspace. Run `npm run inspect`, then pin any unmatched fields in `COLUMN_OVERRIDES`.
- **Live inference:** `POST /api/simulation/run` returns 501 by design. Implement a `ModelServingClient` in `backend/src/services/modelServing.ts` when an endpoint is deployed.
- **Time-series charts:** oil and injection trends need a daily-history table in the Catalog. They show an "awaiting data" state and display no values.
- **Research entries:** still placeholders in `web/src/content/research.ts`.
