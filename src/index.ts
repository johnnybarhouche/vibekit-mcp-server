#!/usr/bin/env node
/**
 * VibeCodersKit MCP Server
 *
 * Provides Claude Code access to your saved prompts via the Model Context Protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// Configuration
const CONFIG_DIR = join(homedir(), ".vibekit");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");
const API_BASE_URL = process.env.VIBEKIT_API_URL || "https://vibecoderskit.com";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Load stored access token
 */
function loadToken(): TokenData | null {
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

/**
 * Save updated token data to disk
 */
function saveToken(tokenData: TokenData): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), { mode: 0o600 });
}

/**
 * Refresh an expired access token using the refresh token
 */
async function refreshAccessToken(token: TokenData): Promise<TokenData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp/auth/refresh`, {
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

/**
 * Make authenticated API request (auto-refreshes expired tokens)
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token = loadToken();
  if (!token) {
    throw new Error(
      "Not authenticated. Run vck_login to connect your VibeCodersKit account."
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
        "Authentication expired. Run vck_login to reconnect your account."
      );
    }

    // Retry the request with the new token
    const retry = await fetch(`${API_BASE_URL}${endpoint}`, {
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

    return retry.json();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Create server
const server = new Server(
  {
    name: "vibekit",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_prompts",
        description:
          "List your saved prompts from VibeCodersKit. Returns prompt names, descriptions, and IDs.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Filter by category (optional)",
            },
            limit: {
              type: "number",
              description: "Max results to return (default 20, max 100)",
            },
          },
        },
      },
      {
        name: "get_prompt",
        description:
          "Get the full content of a specific prompt by ID or name. Use this to retrieve the actual prompt text.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Prompt ID (UUID)",
            },
            name: {
              type: "string",
              description:
                "Prompt name (will search if ID not provided)",
            },
          },
        },
      },
      {
        name: "save_prompt",
        description:
          "Save a new prompt to your VibeCodersKit library for future use.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name for the prompt",
            },
            content: {
              type: "string",
              description: "The prompt content/text",
            },
            description: {
              type: "string",
              description: "Brief description of what the prompt does",
            },
            category: {
              type: "string",
              enum: [
                "Code Generation",
                "Code Review",
                "Documentation",
                "Debugging",
                "Refactoring",
                "Testing",
                "Explanation",
                "Translation",
                "Other",
              ],
              description: "Category for the prompt",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for organization",
            },
            projects: {
              type: "array",
              items: { type: "string" },
              description: "Project names to associate with this prompt",
            },
          },
          required: ["name", "content"],
        },
      },
      {
        name: "delete_prompt",
        description: "Delete a prompt from your library by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Prompt ID to delete",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "vck_status",
        description:
          "Check your VibeCodersKit connection status. Shows whether you're logged in, your account info, and token expiry.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "vck_logout",
        description:
          "Disconnect your VibeCodersKit account. Removes stored credentials and optionally revokes the token server-side.",
        inputSchema: {
          type: "object",
          properties: {
            revoke: {
              type: "boolean",
              description:
                "Also revoke the token server-side (default: true)",
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_prompts": {
        const params = new URLSearchParams();
        if (args?.category) params.set("category", String(args.category));
        if (args?.limit) params.set("limit", String(args.limit));

        const query = params.toString();
        const data = await apiRequest<{ prompts: Prompt[]; total: number }>(
          `/api/mcp/prompts${query ? `?${query}` : ""}`
        );

        if (data.prompts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No prompts found. Save some prompts to your VibeCodersKit library first!",
              },
            ],
          };
        }

        const list = data.prompts
          .map(
            (p) =>
              `- **${p.name}** (${p.id})\n  ${p.description || "No description"}${p.category ? `\n  Category: ${p.category}` : ""}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${data.total} prompt(s):\n\n${list}`,
            },
          ],
        };
      }

      case "get_prompt": {
        let prompt: Prompt;

        if (args?.id) {
          prompt = await apiRequest<Prompt>(`/api/mcp/prompts/${args.id}`);
        } else if (args?.name) {
          // Search by name
          const data = await apiRequest<{ prompts: Prompt[] }>(
            `/api/mcp/prompts?limit=100`
          );
          const found = data.prompts.find(
            (p) => p.name.toLowerCase() === String(args.name).toLowerCase()
          );
          if (!found) {
            return {
              content: [
                {
                  type: "text",
                  text: `No prompt found with name "${args.name}"`,
                },
              ],
            };
          }
          prompt = await apiRequest<Prompt>(`/api/mcp/prompts/${found.id}`);
        } else {
          return {
            content: [
              {
                type: "text",
                text: "Please provide either an id or name to get a prompt.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `# ${prompt.name}\n\n${prompt.description ? `*${prompt.description}*\n\n` : ""}${prompt.content}`,
            },
          ],
        };
      }

      case "save_prompt": {
        if (!args?.name || !args?.content) {
          return {
            content: [
              {
                type: "text",
                text: "Name and content are required to save a prompt.",
              },
            ],
          };
        }

        const newPrompt = await apiRequest<Prompt>("/api/mcp/prompts", {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            content: args.content,
            description: args.description,
            category: args.category,
            tags: args.tags,
            projects: args.projects,
          }),
        });

        return {
          content: [
            {
              type: "text",
              text: `Saved prompt "${newPrompt.name}" (ID: ${newPrompt.id})`,
            },
          ],
        };
      }

      case "delete_prompt": {
        if (!args?.id) {
          return {
            content: [
              {
                type: "text",
                text: "Prompt ID is required to delete.",
              },
            ],
          };
        }

        await apiRequest(`/api/mcp/prompts/${args.id}`, {
          method: "DELETE",
        });

        return {
          content: [
            {
              type: "text",
              text: `Deleted prompt ${args.id}`,
            },
          ],
        };
      }

      case "vck_status": {
        const token = loadToken();

        if (!token) {
          return {
            content: [
              {
                type: "text",
                text: "Not connected. Run vck_login to connect your VibeCodersKit account.",
              },
            ],
          };
        }

        const expiresAt = new Date(token.expires_at);
        const isExpired = expiresAt < new Date();
        const expiresIn = Math.round(
          (expiresAt.getTime() - Date.now()) / 1000 / 60
        );

        return {
          content: [
            {
              type: "text",
              text: [
                `Connected to VibeCodersKit`,
                ``,
                `  Account: ${token.user.name} (${token.user.email})`,
                `  Token:   ${isExpired ? "EXPIRED" : `valid for ${expiresIn} minutes`}`,
                isExpired
                  ? `\nYour token has expired. Run vck_login to reconnect.`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      }

      case "vck_logout": {
        const token = loadToken();

        if (!token) {
          return {
            content: [
              {
                type: "text",
                text: "Already disconnected — no stored credentials found.",
              },
            ],
          };
        }

        // Revoke server-side unless explicitly opted out
        const shouldRevoke = args?.revoke !== false;
        if (shouldRevoke) {
          try {
            await fetch(`${API_BASE_URL}/api/mcp/auth/revoke`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token.access_token}`,
              },
            });
          } catch {
            // Best-effort revocation — still delete local file
          }
        }

        // Delete local token file
        try {
          unlinkSync(TOKEN_FILE);
        } catch {
          // File may already be gone
        }

        return {
          content: [
            {
              type: "text",
              text: `Disconnected ${token.user.email} from VibeCodersKit.${shouldRevoke ? " Token revoked server-side." : ""}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
});

// List resources (prompts as resources)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const data = await apiRequest<{ prompts: Prompt[] }>(
      "/api/mcp/prompts?limit=50"
    );

    return {
      resources: data.prompts.map((p) => ({
        uri: `vibekit://prompt/${p.id}`,
        name: p.name,
        description: p.description || undefined,
        mimeType: "text/plain",
      })),
    };
  } catch {
    return { resources: [] };
  }
});

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^vibekit:\/\/prompt\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const prompt = await apiRequest<Prompt>(`/api/mcp/prompts/${match[1]}`);

  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text: prompt.content,
      },
    ],
  };
});

// Start server
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VibeCodersKit MCP server running");
}

// CLI subcommand routing
const subcommand = process.argv[2];

if (subcommand === "login") {
  // Dynamically import login script
  import("./login.js");
} else if (subcommand === "help" || subcommand === "--help") {
  console.log(`
VibeCodersKit MCP Server

Usage:
  npx @vibekit/mcp-server          Start the MCP server (stdio)
  npx @vibekit/mcp-server login    Connect your VibeCodersKit account
  npx @vibekit/mcp-server help     Show this help message
`);
} else {
  startServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
