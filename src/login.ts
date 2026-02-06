#!/usr/bin/env node
/**
 * VibeCodersKit Login Script
 *
 * Authenticates with VibeCodersKit using OAuth device flow.
 * Run this to connect your account before using the MCP server.
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_DIR = join(homedir(), ".vibekit");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");
const API_BASE_URL = process.env.VIBEKIT_API_URL || "https://vibecoderskit.ai";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/auth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "claude-code",
      scope: "prompts:read prompts:write",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get device code: ${response.status}`);
  }

  return response.json();
}

async function pollForToken(deviceCode: string, interval: number): Promise<TokenResponse> {
  while (true) {
    await sleep(interval * 1000);

    const response = await fetch(`${API_BASE_URL}/api/mcp/auth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });

    const data: TokenResponse | ErrorResponse = await response.json();

    if ("access_token" in data) {
      return data;
    }

    if (data.error === "authorization_pending") {
      // Keep polling
      process.stdout.write(".");
      continue;
    }

    if (data.error === "slow_down") {
      // Increase interval
      interval += 5;
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Authorization timed out. Please try again.");
    }

    throw new Error(data.error_description || data.error || "Authentication failed");
  }
}

function saveToken(token: TokenResponse): void {
  // Ensure config directory exists
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const tokenData = {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    user: token.user,
  };

  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

async function main() {
  console.log("\n🎨 VibeCodersKit Login\n");
  console.log("Connecting your VibeCodersKit account to Claude Code...\n");

  try {
    // Step 1: Request device code
    const deviceCode = await requestDeviceCode();

    // Step 2: Show instructions
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log(`  Open this URL in your browser:`);
    console.log(`  ${deviceCode.verification_uri}`);
    console.log("");
    console.log(`  Enter this code: ${deviceCode.user_code}`);
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("Waiting for authorization");

    // Step 3: Poll for token
    const token = await pollForToken(deviceCode.device_code, deviceCode.interval);

    // Step 4: Save token
    saveToken(token);

    console.log("\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log(`  ✓ Connected as ${token.user.name} (${token.user.email})`);
    console.log("");
    console.log("  You can now use VibeCodersKit tools in Claude Code:");
    console.log("  • list_prompts - View your saved prompts");
    console.log("  • get_prompt - Get prompt content by name or ID");
    console.log("  • save_prompt - Save new prompts to your library");
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (error) {
    console.error(`\nError: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

main();
