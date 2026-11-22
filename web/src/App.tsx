import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { WellsProvider } from './hooks/useWells'
import OverviewPage from './pages/OverviewPage'
import WellExplorerPage from './pages/WellExplorerPage'
import SimulationPage from './pages/SimulationPage'
import AnalyticsPage from './pages/AnalyticsPage'

export default function App() {
  return (
    <WellsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="wells" element={<WellExplorerPage />} />
            <Route path="simulation" element={<SimulationPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WellsProvider>
  )
}
