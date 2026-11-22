/** Typed endpoints of the FloodIQ backend (see backend/README section in the root README). */
import { apiGet } from './client'
import type { EconomicsResponse, HealthResponse, OverviewResponse, PerformanceResponse, SimulationStatus, TableRowsResponse, WellDetailResponse } from './types'
import type { WellFeatureCollection } from '../types/well'

export interface PageParams { limit?: number; offset?: number; sort?: string; dir?: 'asc' | 'desc' }

export const floodiqApi = {
  health: (signal?: AbortSignal) => apiGet<HealthResponse>('/api/health', {}, signal),
  overview: (signal?: AbortSignal) => apiGet<OverviewResponse>('/api/overview', {}, signal),
  wells: (signal?: AbortSignal) => apiGet<WellFeatureCollection>('/api/wells', {}, signal),
  well: (uwi: string, signal?: AbortSignal) => apiGet<WellDetailResponse>(`/api/wells/${encodeURIComponent(uwi)}`, {}, signal),
  performance: (p: PageParams & { class?: string; area?: string; search?: string } = {}, signal?: AbortSignal) =>
    apiGet<PerformanceResponse>('/api/performance', { ...p }, signal),
  pairs: (p: PageParams & { uwi?: string; area?: string; maxDistance?: number } = {}, signal?: AbortSignal) =>
    apiGet<TableRowsResponse>('/api/injector-producer-pairs', { ...p }, signal),
  conversionRanking: (p: PageParams & { area?: string; search?: string; minScore?: number } = {}, signal?: AbortSignal) =>
    apiGet<TableRowsResponse>('/api/conversion-ranking', { ...p }, signal),
  conversionEconomics: (p: PageParams & { scenario?: string; uwi?: string; search?: string } = {}, signal?: AbortSignal) =>
    apiGet<EconomicsResponse>('/api/conversion-economics', { ...p }, signal),
  simulationStatus: (signal?: AbortSignal) => apiGet<SimulationStatus>('/api/simulation/status', {}, signal),
}
