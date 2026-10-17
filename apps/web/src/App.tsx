import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

function RouteLoading() {
  return <div className="route-loading"><span className="button-spinner" /> Restoring your workspace…</div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user ? children : <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
