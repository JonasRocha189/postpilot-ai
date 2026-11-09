import { ScrollToTop } from "@/components/common/ScrollToTop";
import { setTokenGetter } from "@/lib/api/http";
import { auth0Config, authMode, DEFAULT_RETURN_TO } from "@/lib/auth/config";
import { markActivity } from "@/lib/auth/idle";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";

/** Entrega ao cliente da API a função que obtém o access token do Auth0. */
function ApiTokenBridge() {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    setTokenGetter(() => getAccessTokenSilently());
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently]);
  return null;
}

/**
 * Rota raiz: envolve todas as páginas no Auth0Provider.
 * Fica dentro do roteador para poder navegar após o retorno do login.
 */
export default function AuthProvider() {
  const navigate = useNavigate();

  const content = (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );

  if (authMode !== "auth0") return content;

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/login`,
        audience: auth0Config.audience,
      }}
      // Mantém a sessão ao recarregar a página, sem depender de cookies de terceiros
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        // Fresh login: the inactivity timer starts now
        markActivity();
        navigate(appState?.returnTo ?? DEFAULT_RETURN_TO, { replace: true });
      }}
    >
      <ApiTokenBridge />
      {content}
    </Auth0Provider>
  );
}
