"""
Build one GeoJSON feature per UWI from daily_production.parquet.

Usage:
    python scripts/build_wells_geojson.py            # writes web/public/data/wells.geojson

Classification rules (no random assignment):
  1. Latest non-null `flow_direction` for the UWI ("injection" / "production").
  2. If flow_direction is never recorded, fall back to the latest non-null
     `well_daily_status`: "Injecting" -> injection, "Producing" -> production.
  3. Otherwise the well is "unknown".

Latest measurements are the most recent non-null values (with their dates);
missing values stay null — nothing is imputed.
"""
import json
import pathlib
import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "daily_production.parquet"
OUT = ROOT / "web" / "public" / "data" / "wells.geojson"

QUERY = f"""
WITH src AS (SELECT * FROM read_parquet('{SRC.as_posix()}')),
base AS (
  SELECT uwi,
    arg_max(formatted_uwi, production_date) FILTER (WHERE formatted_uwi IS NOT NULL) AS formatted_uwi,
    arg_max(well_name, production_date) FILTER (WHERE well_name IS NOT NULL) AS well_name,
    arg_max(province, production_date) FILTER (WHERE province IS NOT NULL) AS province,
    arg_max(field_operating_area, production_date) FILTER (WHERE field_operating_area IS NOT NULL) AS field_operating_area,
    arg_max(surface_latitude, production_date) FILTER (WHERE surface_latitude IS NOT NULL) AS lat,
    arg_max(surface_longitude, production_date) FILTER (WHERE surface_longitude IS NOT NULL) AS lon,
    arg_max(flow_direction, production_date) FILTER (WHERE flow_direction IS NOT NULL) AS flow_direction,
    arg_max(well_daily_status, production_date) FILTER (WHERE well_daily_status IS NOT NULL) AS status,
    max(production_date) FILTER (WHERE well_daily_status IS NOT NULL) AS status_date,
    arg_max(oil_produced_m3, production_date) FILTER (WHERE oil_produced_m3 IS NOT NULL) AS oil_m3,
    max(production_date) FILTER (WHERE oil_produced_m3 IS NOT NULL) AS oil_date,
    arg_max(water_produced_m3, production_date) FILTER (WHERE water_produced_m3 IS NOT NULL) AS water_prod_m3,
    max(production_date) FILTER (WHERE water_produced_m3 IS NOT NULL) AS water_prod_date,
    arg_max(gas_produced_e3m3, production_date) FILTER (WHERE gas_produced_e3m3 IS NOT NULL) AS gas_e3m3,
    max(production_date) FILTER (WHERE gas_produced_e3m3 IS NOT NULL) AS gas_date,
    arg_max(injected_water_m3, production_date) FILTER (WHERE injected_water_m3 IS NOT NULL) AS inj_water_m3,
    max(production_date) FILTER (WHERE injected_water_m3 IS NOT NULL) AS inj_water_date,
    min(production_date) AS first_date,
    max(production_date) AS last_date,
    count(*) AS record_count
  FROM src
  GROUP BY uwi
)
SELECT * FROM base ORDER BY uwi
"""


def classify(flow, status):
    if flow in ("injection", "production"):
        return flow
    if status == "Injecting":
        return "injection"
    if status == "Producing":
        return "production"
    return "unknown"


def f(v):
    return None if v is None else round(float(v), 3)


def d(v):
    return None if v is None else v.isoformat()


def main():
    con = duckdb.connect()
    cur = con.execute(QUERY)
    cols = [c[0] for c in cur.description]
    features, skipped = [], 0
    for row in cur.fetchall():
        r = dict(zip(cols, row))
        if r["lat"] is None or r["lon"] is None:
            skipped += 1
            continue
        features.append({
            "type": "Feature",
            "id": len(features),
            "geometry": {"type": "Point", "coordinates": [round(float(r["lon"]), 6), round(float(r["lat"]), 6)]},
            "properties": {
                "uwi": r["uwi"],
                "formattedUwi": r["formatted_uwi"],
                "wellName": r["well_name"],
                "province": r["province"],
                "operatingArea": r["field_operating_area"],
                "wellType": classify(r["flow_direction"], r["status"]),
                "flowDirection": r["flow_direction"],
                "status": r["status"],
                "statusDate": d(r["status_date"]),
                "latestOilM3": f(r["oil_m3"]),
                "latestOilDate": d(r["oil_date"]),
                "latestWaterProducedM3": f(r["water_prod_m3"]),
                "latestWaterProducedDate": d(r["water_prod_date"]),
                "latestGasE3m3": f(r["gas_e3m3"]),
                "latestGasDate": d(r["gas_date"]),
                "latestInjectedWaterM3": f(r["inj_water_m3"]),
                "latestInjectedWaterDate": d(r["inj_water_date"]),
                "firstRecordDate": d(r["first_date"]),
                "lastRecordDate": d(r["last_date"]),
                "recordCount": r["record_count"],
            },
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "source": "daily_production.parquet",
        "featureCount": len(features),
        "skippedNoCoordinates": skipped,
    }
    OUT.write_text(json.dumps({"type": "FeatureCollection", "metadata": meta, "features": features}, separators=(",", ":")))
    print(json.dumps(meta), "->", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
