import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { Auth } from './pages/Auth'
import { Browse } from './pages/Browse'
import { Chat } from './pages/Chat'
import { Dashboard } from './pages/Dashboard'
import { ListingDetail } from './pages/ListingDetail'
import { ListingForm } from './pages/ListingForm'
import { Pulse } from './pages/Pulse'
import { StudentProfile } from './pages/StudentProfile'
import { Swaps } from './pages/Swaps'
import { Wishlist } from './pages/Wishlist'
import { AuthProvider, useAuth } from './store/auth'
import { ToastProvider } from './store/toast'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Browse />} />
              <Route path="listing/:id" element={<ListingDetail />} />
              <Route path="swaps" element={<Swaps />} />
              <Route path="pulse" element={<Pulse />} />
              <Route path="students/:id" element={<StudentProfile />} />
              <Route path="login" element={<Auth mode="login" />} />
              <Route path="signup" element={<Auth mode="signup" />} />
              <Route
                path="sell"
                element={
                  <Protected>
                    <ListingForm />
                  </Protected>
                }
              />
              <Route
                path="listing/:id/edit"
                element={
                  <Protected>
                    <ListingForm />
                  </Protected>
                }
              />
              <Route
                path="wishlist"
                element={
                  <Protected>
                    <Wishlist />
                  </Protected>
                }
              />
              <Route
                path="chat"
                element={
                  <Protected>
                    <Chat />
                  </Protected>
                }
              />
              <Route
                path="dashboard"
                element={
                  <Protected>
                    <Dashboard />
                  </Protected>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  )
}
