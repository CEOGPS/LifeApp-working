import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/SupabaseAuthContext";
import { motion } from "framer-motion";

export default function Logout() {
  const navigate = useNavigate();
  const { logout, isLoadingAuth } = useAuth();

  useEffect(() => {
    const doLogout = async () => {
      await logout();
      navigate("/");
    };
    doLogout();
  }, [logout, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-svh w-full items-center justify-center"
    >
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted"
        >
          <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </motion.div>
        <p className="mt-4 text-muted-foreground">Signing you out...</p>
      </div>
    </motion.div>
  );
}