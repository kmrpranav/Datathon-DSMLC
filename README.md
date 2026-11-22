# FloodIQ: Oilfield Intelligence Platform

Datathon project: a dashboard for exploring oil and gas wells, water injection and well-conversion opportunities. It's backed by the team's Databricks Unity Catalog tables.

## Repository layout

```
daily_production.parquet        # 5,075,590 daily rows, 2,905 wells (Git LFS)
well_jobs.parquet               # 15,610 maintenance job records
production_failures.parquet     # 2,873 equipment failures
scripts/build_wells_geojson.py  # parquet -> local well snapshot (fallback for the map)
backend/                        # Node + Express + TypeScript API -> Databricks SQL Statement Execution API
web/                            # React + TypeScript + Tailwind + Mapbox frontend
```

## Quick start

You need two terminals.

```bash
# 1. Backend (Databricks credentials live ONLY here)
cd backend
cp .env.example .env        # fill in DATABRICKS_HOST / DATABRICKS_WAREHOUSE_ID / DATABRICKS_TOKEN
npm install
npm run inspect             # optional, but recommended once: verifies access + schemas
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

- **Backend down or not configured:** the Well Explorer falls back to the local parquet snapshot (`web/public/data/wells.geojson`) and says so. Databricks-only sections show a "not connected" state with a retry button.
- **No Mapbox token:** the maps show a "token required" notice. Everything else still works.

### Environment variables (`backend/.env`, gitignored)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABRICKS_HOST` | yes | e.g. `https://dbc-xxxx.cloud.databricks.com` |
| `DATABRICKS_WAREHOUSE_ID` | yes | SQL Warehouse → Connection details |
| `DATABRICKS_TOKEN` | yes | PAT for authorized local development; use an OAuth service principal for shared deployments |
| `DATABRICKS_CATALOG` / `DATABRICKS_SCHEMA` | no | default `workspace` / `default` |
| `PORT` | no | default `3001` |
| `FRONTEND_ORIGIN` | no | CORS allowlist, comma-separated; default `http://localhost:5173` |
| `CACHE_TTL_SECONDS` | no | default `600` |
| `QUERY_TIMEOUT_SECONDS` | no | default `120` |

The token is never sent to the browser, never included in API responses or logs, and `.env` files are gitignored. The frontend only knows `VITE_MAPBOX_TOKEN`, `VITE_API_URL` and `VITE_WELLS_URL`.

## Backend design (`backend/src`)

| Path | Purpose |
| --- | --- |
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
- Nothing writes to the Catalog.
- Other protections: restricted CORS, rate limiting (300 requests per minute per IP), and 32 kB JSON bodies.
- Request logs record only method, path, status and duration: no query strings, headers or tokens.

**Column names are verified, not assumed.**

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
| `GET /api/health` | `deep=1` | Config presence. `deep=1` also runs `SELECT 1` and checks each table |
| `GET /api/wells` | `area`, `province`, `type` (`injection`/`production`/`unknown`/`dual`), `performance`, `search` | GeoJSON FeatureCollection, one feature per UWI, `[lng, lat]` |
| `GET /api/wells/:uwi` | | Master attributes, performance rows, pairs, ranking, economics. 404 if unknown |
| `GET /api/performance` | `class`, `area`, `search`, `limit`, `offset`, `sort`, `dir` | `summary` (SQL `GROUP BY` of the existing classes) plus a page of rows |
| `GET /api/injector-producer-pairs` | `uwi`, `injector`, `producer`, `area`, `maxDistance`, paging | Proximity disclaimer included |
| `GET /api/conversion-ranking` | `area`, `search`, `minScore`, paging, `sort`, `dir` | Saved ranking, passed through as-is |
| `GET /api/conversion-economics` | `scenario`, `uwi`, `search`, paging | Rows plus distinct `scenarios`, with an estimate disclaimer |
| `GET /api/overview` | | Overview KPIs |
| `GET /api/meta/schema` | | Columns and field resolution per table (no data) |
| `GET /api/simulation/status`, `POST /api/simulation/run` | | Live inference boundary. `run` returns **501** until a Model Serving endpoint exists |

Paging defaults are `limit=50` (max 500) and `offset=0`.

### Response examples

These show the response *shape*. Column names inside `metrics` and `rows` are the real Databricks column names, so they will differ from the ones shown here.

```jsonc
// GET /api/health
{ "status": "degraded", "service": "floodiq-api", "version": "0.1.0",
  "databricks": { "configured": false, "missing": ["DATABRICKS_TOKEN"], "catalog": "workspace", "schema": "default" },
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

1. Run `npm run inspect` in `backend/`. It authenticates and then works through each table:
   - It runs `SELECT 1`, then `DESCRIBE`s every table.
   - It samples 10 rows from each table and compares row count with distinct UWIs (the duplicate check).
   - It checks how many wells have valid coordinates.
   - It writes `backend/schema-report.json` (gitignored, because it contains sample rows).
2. Run `npm run dev`, then `curl localhost:3001/api/health?deep=1` and `curl localhost:3001/api/meta/schema`.
3. Run `curl 'localhost:3001/api/wells' | jq '.metadata'`. Check `total`, `excluded` and `duplicates`.
4. Open the app. The Well Explorer should say **Live from Databricks**.

Tests: `npm test` in `backend/` runs 31 tests against a mocked warehouse and mocked `fetch`. They cover polling, chunking, failure, cancel and timeout, auth errors, type normalization, parameter binding, sort allowlisting, de-duplication, dual-role classification, filters, 404 and 400 responses, CORS, and the 501 inference boundary.

## Local snapshot (fallback) data

`scripts/build_wells_geojson.py` builds one feature per UWI from `daily_production.parquet` (requires duckdb).

- **Current type:** the latest `flow_direction`, otherwise the latest `well_daily_status`.
- **Historical roles:** whether the well ever produced (oil > 0 or a production flow direction) and ever injected (injected volume > 0 or an injection flow direction). 66 wells have both.
- **Missing values:** stay missing, shown as "Not recorded". Nothing is imputed.

## Not yet done

- **Live Databricks verification:** no credentials were available while building, so the connection, the real column names, uniqueness per UWI and coordinate validity haven't been checked against the workspace. Run `npm run inspect`, then pin any unmatched fields in `COLUMN_OVERRIDES`.
- **`bushra_producer_features_latest`:** only surfaced in `/api/wells/:uwi` for now.
- **Live inference:** `POST /api/simulation/run` returns 501 by design. Implement a `ModelServingClient` in `backend/src/services/modelServing.ts` when an endpoint is deployed.
- **Time-series charts:** oil and injection trends need a daily-history table in the Catalog. They show an "awaiting data" state and display no values.
- **Research entries:** still placeholders in `web/src/content/research.ts`.
