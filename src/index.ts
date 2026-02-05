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
import { readFileSync, existsSync } from "fs";
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
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = loadToken();
  if (!token) {
    throw new Error(
      "Not authenticated. Run vck_login to connect your VibeCodersKit account."
    );
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error(
      "Authentication expired. Run vck_login to reconnect your account."
    );
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
              description: "Category (e.g., coding, writing, analysis)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tags for organization",
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
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VibeCodersKit MCP server running");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
