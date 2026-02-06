/**
 * Token management — load, save, refresh
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".vibekit");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export function getTokenFilePath(): string {
  return TOKEN_FILE;
}

export function loadToken(): TokenData | null {
  if (!existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    const data = readFileSync(TOKEN_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveToken(tokenData: TokenData): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

export function deleteToken(): void {
  try {
    unlinkSync(TOKEN_FILE);
  } catch {
    // File may already be gone
  }
}

export function getApiBaseUrl(): string {
  return process.env.VIBEKIT_API_URL || "https://vibecoderskit.com";
}

export async function refreshAccessToken(token: TokenData): Promise<TokenData | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/mcp/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refresh_token }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const updated: TokenData = {
      ...token,
      access_token: data.access_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };

    saveToken(updated);
    return updated;
  } catch {
    return null;
  }
}
