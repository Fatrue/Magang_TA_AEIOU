import { Navigate, Outlet } from "react-router-dom";
import { IrrigationProvider } from "../context/IrrigationContext";
import { useAuth } from "../context/AuthContext";

// Halaman di bawah ini hanya bisa dibuka setelah login. Data baru diambil setelah login berhasil.
export function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <IrrigationProvider>
      <Outlet />
    </IrrigationProvider>
  );
}