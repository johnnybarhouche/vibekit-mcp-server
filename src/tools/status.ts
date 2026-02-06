/**
 * Status & logout tools — vck_status, vck_logout
 */

import { loadToken, deleteToken, getApiBaseUrl } from "../auth.js";

export const statusToolDefinitions = [
  {
    name: "vck_status",
    description:
      "Check your VibeCodersKit connection status. Shows whether you're logged in, your account info, and token expiry.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "vck_logout",
    description:
      "Disconnect your VibeCodersKit account. Removes stored credentials and optionally revokes the token server-side.",
    inputSchema: {
      type: "object" as const,
      properties: {
        revoke: {
          type: "boolean",
          description: "Also revoke the token server-side (default: true)",
        },
      },
    },
  },
];

export async function handleStatusTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "vck_status": {
      const token = loadToken();

      if (!token) {
        return {
          content: [{
            type: "text",
            text: "Not connected. Run `npx vibekit-mcp-server login` to connect your account.",
          }],
        };
      }

      const expiresAt = new Date(token.expires_at);
      const isExpired = expiresAt < new Date();
      const expiresIn = Math.round((expiresAt.getTime() - Date.now()) / 1000 / 60);

      return {
        content: [{
          type: "text",
          text: [
            `Connected to VibeCodersKit`,
            ``,
            `  Account: ${token.user.name} (${token.user.email})`,
            `  Token:   ${isExpired ? "EXPIRED" : `valid for ${expiresIn} minutes`}`,
            isExpired ? `\nYour token has expired. Run \`npx vibekit-mcp-server login\` to reconnect.` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        }],
      };
    }

    case "vck_logout": {
      const token = loadToken();

      if (!token) {
        return {
          content: [{ type: "text", text: "Already disconnected — no stored credentials found." }],
        };
      }

      const shouldRevoke = args?.revoke !== false;
      if (shouldRevoke) {
        try {
          await fetch(`${getApiBaseUrl()}/api/mcp/auth/revoke`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token.access_token}`,
            },
          });
        } catch {
          // Best-effort revocation
        }
      }

      deleteToken();

      return {
        content: [{
          type: "text",
          text: `Disconnected ${token.user.email} from VibeCodersKit.${shouldRevoke ? " Token revoked server-side." : ""}`,
        }],
      };
    }

    default:
      return null;
  }
}
