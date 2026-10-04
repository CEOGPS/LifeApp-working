import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/SupabaseAuthContext";
import { motion } from "framer-motion";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-svh w-full items-center justify-center"
      >
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Checking authentication...</p>
        </div>
      </motion.div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}