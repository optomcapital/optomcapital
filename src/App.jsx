import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/layout/Layout.jsx'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CustomerList from './pages/Customers/CustomerList.jsx'
import CustomerDetail from './pages/Customers/CustomerDetail.jsx'
import LeadList from './pages/Leads/LeadList.jsx'
import LeadDetail from './pages/Leads/LeadDetail.jsx'
import LeadPipeline from './pages/Leads/LeadPipeline.jsx'
import DocumentsPage from './pages/Documents/DocumentsPage.jsx'
import BankApplicationList from './pages/BankApplications/BankApplicationList.jsx'
import DisbursementList from './pages/Disbursements/DisbursementList.jsx'
import ReportsPage from './pages/Reports/ReportsPage.jsx'
import RelationshipsPage from './pages/Relationships/RelationshipsPage.jsx'
import SettingsPage from './pages/Settings/SettingsPage.jsx'

function AppBlockedScreen() {
  const { logout } = useAuth()

  useEffect(() => {
    logout()
  }, [logout])

  return (
    <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
      <div className="w-[520px] max-w-full rounded-panel border border-border-subtle bg-surface shadow-panel p-6">
        <div className="text-center">
          <div className="text-[18px] font-semibold text-accent">Optom Capital</div>
          <div className="mt-2 text-[14px] font-medium">Access temporarily paused</div>
          <div className="mt-2 text-[13px] text-text-secondary">
            Clear overdues and contact admin to resume the app.
          </div>
        </div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading, mfaPending } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user || mfaPending) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  const locked = String(import.meta.env.VITE_APP_LOCKED || '').trim() === '1'
  if (locked) return <AppBlockedScreen />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="leads" element={<LeadList />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="pipeline" element={<LeadPipeline />} />
        <Route path="bank-applications" element={<BankApplicationList />} />
        <Route path="relationships" element={<RelationshipsPage />} />
        <Route path="disbursements" element={<DisbursementList />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
