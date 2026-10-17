import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// UI guard only: the server enforces the real permission (403 for non-admins).
export default function AdminRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p className="py-16 text-center text-slate-500">Loading...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
