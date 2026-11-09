// Inactivity timeout: after IDLE_TIMEOUT_MS without user activity, the session ends.
// The last activity lives in localStorage so every open tab shares it: activity in
// one tab keeps the others alive, and a session left open overnight is closed on return.

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** How long before the logout the warning appears */
export const IDLE_WARNING_MS = 60 * 1000;

const LAST_ACTIVITY_KEY = "postpilot:last-activity";
/** Set right before an idle logout, so the login page can explain why */
const IDLE_LOGOUT_FLAG = "postpilot:idle-logout";

export function readLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markActivity(now = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch {
    // storage unavailable: the hook keeps the activity in memory
  }
}

/** Called on every logout, so the next login starts a fresh session */
export function clearActivity() {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // nothing to clear
  }
}

export function flagIdleLogout() {
  try {
    sessionStorage.setItem(IDLE_LOGOUT_FLAG, "1");
  } catch {
    // the login page just won't show the reason
  }
}

export function wasIdleLogout(): boolean {
  try {
    return sessionStorage.getItem(IDLE_LOGOUT_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearIdleLogoutFlag() {
  try {
    sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
  } catch {
    // nothing to clear
  }
}
