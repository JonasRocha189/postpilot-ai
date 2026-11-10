import { ScrollToTop } from "@/components/common/ScrollToTop";
import { setTokenGetter } from "@/lib/api/http";
import { auth0Config, authMode, DEFAULT_RETURN_TO } from "@/lib/auth/config";
import { markActivity } from "@/lib/auth/idle";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";

/** Gives the API client the function that gets the Auth0 access token. */
function ApiTokenBridge() {
  const { getAccessTokenSilently } = useAuth0();
  useEffect(() => {
    setTokenGetter(() => getAccessTokenSilently());
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently]);
  return null;
}

/**
 * Root route: wraps every page in the Auth0Provider.
 * It lives inside the router so it can navigate after the login redirect.
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
      // Keeps the session on page reload, without relying on third-party cookies
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
