import { useAuth } from "@/lib/auth/useAuth";
import { Navigate, Outlet, useLocation } from "react-router";
import IdleLogout from "./IdleLogout";
import LoadingScreen from "./LoadingScreen";

/** Protege as rotas filhas: sem sessão, redireciona para /login e volta depois. */
export default function RequireAuth() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return (
    <>
      <IdleLogout />
      <Outlet />
    </>
  );
}
