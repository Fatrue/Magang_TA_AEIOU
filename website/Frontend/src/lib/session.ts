import type { LoginResult, User } from "../types";

export const TOKEN_KEY = "irigasi_token";
export const USER_KEY = "irigasi_user";

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveSession(r: LoginResult) {
  localStorage.setItem(TOKEN_KEY, r.token);
  localStorage.setItem(USER_KEY, JSON.stringify(r.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}