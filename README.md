# FloodIQ — Oilfield Intelligence Platform

Datathon project: a dashboard for exploring oil & gas well data, injection/production wells, and waterflood opportunities.

## Repository layout

```
daily_production.parquet      # 5,075,590 daily rows, 2,905 wells (Git LFS)
well_jobs.parquet             # 15,610 maintenance job records
production_failures.parquet   # 2,873 equipment failures
scripts/build_wells_geojson.py  # parquet -> one GeoJSON feature per UWI
web/                          # React + TypeScript + Tailwind + Mapbox frontend
```

## Quick start

```bash
# 1. Build the well features (needs duckdb)
python3 -m venv .venv && .venv/bin/pip install duckdb
.venv/bin/python scripts/build_wells_geojson.py    # -> web/public/data/wells.geojson

# 2. Run the frontend
cd web
cp .env.example .env.local     # then paste your Mapbox public token (pk.…)
npm install
npm run dev
```

Without `VITE_MAPBOX_TOKEN` the maps show a "token required" notice; the rest of the app (table, filters, info panel) still works.

## Data contract

`web/src/types/well.ts` defines `WellProperties`, the shape of each feature in `wells.geojson`.
`web/src/data/wellsService.ts` is the only place that fetches it. Set `VITE_WELLS_URL` to point at a backend endpoint that returns the same GeoJSON shape.

Well classification (no random assignment):
1. latest non-null `flow_direction` for the UWI;
2. otherwise latest `well_daily_status` (`Injecting` → injection, `Producing` → production);
3. otherwise "Unclassified".

"Latest" measurements are the most recent non-null daily value for each field, shown with its date. Missing values are shown as "Not recorded", never imputed. 8 wells have no coordinates and are excluded from the map.

## Frontend structure (`web/src`)

| Path | Purpose |
| --- | --- |
| `config/` | env + design tokens shared with Mapbox/Recharts |
| `data/`, `hooks/useWells.tsx` | data access, shared wells context |
| `components/layout/` | app shell, collapsible sidebar, mobile drawer, page header |
| `components/ui/` | Button, Card, Select, SearchInput, Badge, Modal, loading/empty states |
| `components/map/` | `BaseMap` (Mapbox lifecycle + theming), `WellsMap` (clustered GeoJSON + WebGL circle layers), legend |
| `components/wells/` | filter bar, well info panel, sortable/paginated table |
| `components/charts/` | `ChartCard` (awaiting-data state), `TimeSeriesChart` (Recharts) |
| `components/simulation/` | workspace panel + engine/overlay interfaces for later phases |
| `content/research.ts` | research cards (placeholders until the team adds verified sources) |
| `pages/` | Overview, Well Explorer, Simulation, Analytics |

## Not yet implemented (by design)

- Simulation engine — `simulationEngine` is `null`; "Run Simulation" shows a coming-soon dialog.
- Analytics charts — every chart shows "Awaiting data integration" until real aggregates are connected.
- Research entries — placeholders; fill in `web/src/content/research.ts`.
