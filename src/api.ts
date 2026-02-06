/**
 * Authenticated API client with auto-refresh
 */

import { loadToken, refreshAccessToken, getApiBaseUrl } from "./auth.js";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token = loadToken();
  if (!token) {
    throw new Error(
      "Not authenticated. Run `npx vibekit-mcp-server login` to connect your account."
    );
  }

  // Auto-refresh if token is expired (with 60s buffer)
  const expiresAt = new Date(token.expires_at);
  if (expiresAt.getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(token);
    if (refreshed) {
      token = refreshed;
    }
  }

  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
      ...options.headers,
    },
  });

  // If still 401 after potential refresh, try one more refresh
  if (response.status === 401) {
    const refreshed = await refreshAccessToken(token);
    if (!refreshed) {
      throw new Error(
        "Authentication expired. Run `npx vibekit-mcp-server login` to reconnect."
      );
    }

    const retry = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshed.access_token}`,
        ...options.headers,
      },
    });

    if (!retry.ok) {
      const error = await retry.json().catch(() => ({}));
      throw new Error(error.error || `API error: ${retry.status}`);
    }

    if (retry.status === 204) return {} as T;
    return retry.json();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}
