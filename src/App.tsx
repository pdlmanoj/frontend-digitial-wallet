import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/auth'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VerifyTwoFactor } from './pages/VerifyTwoFactor'
import { Dashboard } from './pages/Dashboard'
import { Wallets } from './pages/Wallets'
import { Transactions } from './pages/Transactions'
import { Deposit } from './pages/Deposit'
import { Withdraw } from './pages/Withdraw'
import { SendMoney } from './pages/SendMoney'
import { Security } from './pages/Security'
import { Profile } from './pages/Profile'
import { NotFound } from './pages/NotFound'
import { AdminUsers } from './pages/admin/AdminUsers'
import { AdminUserDetail } from './pages/admin/AdminUserDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-2fa" element={<VerifyTwoFactor />} />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/wallet" element={<Wallets />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/deposit" element={<Deposit />} />
            <Route path="/withdraw" element={<Withdraw />} />
            <Route path="/send" element={<SendMoney />} />
            <Route path="/security" element={<Security />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
            <Route
              path="/admin/users/:id"
              element={<RequireAdmin><AdminUserDetail /></RequireAdmin>}
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}