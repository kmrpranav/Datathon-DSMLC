/** Verified record counts from the three supplied Parquet files. */
export const datasetMeta = {
  wells: 2905,
  dailyProductionRecords: 5075590,
  wellJobRecords: 15610,
  equipmentFailures: 2873,
  productionDateRange: { start: '2021-01-01', end: '2026-10-27' },
} as const
