import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
