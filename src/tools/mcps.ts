/**
 * MCP Server Configuration tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface MCPConfig {
  id: string;
  name: string;
  description: string | null;
  server_type: "stdio" | "sse";
  command: string | null;
  args: unknown | null;
  url: string | null;
  env_vars: unknown | null;
  tags: string[] | null;
  projects: string[] | null;
  provider_url: string | null;
  docs_url: string | null;
  client_configs: unknown | null;
  created_at: string;
  updated_at: string;
}

export const mcpConfigToolDefinitions = [
  {
    name: "list_mcp_configs",
    description:
      "List your saved MCP server configurations from VibeCodersKit. Returns config names, server types, and IDs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "get_mcp_config",
    description:
      "Get a full MCP server configuration by ID or name. Returns command, args, env vars, and client configs. After retrieving, save the result as a {name}.mcp.md file in the user's codebase and help them add it to their .mcp.json or claude_desktop_config.json.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "MCP config ID (UUID)" },
        name: {
          type: "string",
          description: "Config name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_mcp_config",
    description:
      "Save an MCP server configuration to VibeCodersKit. Before calling, check the project's .mcp.json or claude_desktop_config.json to extract existing MCP server configurations. Capture the server type (stdio or sse), command, args, environment variables, and any client-specific configs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "MCP server name" },
        description: { type: "string", description: "What this MCP server does" },
        server_type: {
          type: "string",
          enum: ["stdio", "sse"],
          description: "Server transport type: 'stdio' for local process, 'sse' for remote HTTP",
        },
        command: {
          type: "string",
          description: "Command to start the server (stdio only, e.g., 'npx', 'node', 'python')",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command arguments (e.g., ['-y', '@modelcontextprotocol/server-github'])",
        },
        url: {
          type: "string",
          description: "Server URL (SSE only)",
        },
        env_vars: {
          type: "object",
          description:
            "Environment variables needed (use placeholder values for secrets, e.g., { GITHUB_TOKEN: '<your-token>' })",
        },
        provider_url: {
          type: "string",
          description: "URL of the MCP server provider/homepage",
        },
        docs_url: {
          type: "string",
          description: "URL to the server's documentation",
        },
        client_configs: {
          type: "object",
          description:
            "Client-specific configuration overrides (e.g., { claude_desktop: {...}, cursor: {...} })",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for organization",
        },
        projects: {
          type: "array",
          items: { type: "string" },
          description:
            "Project names to associate with this config. Always include the current project or repository name.",
        },
      },
      required: ["name", "server_type"],
    },
  },
  {
    name: "delete_mcp_config",
    description: "Delete an MCP server configuration from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "MCP config ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handleMCPConfigTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "list_mcp_configs": {
      const params = new URLSearchParams();
      if (args?.limit) params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await apiRequest<{ mcps: MCPConfig[]; total: number }>(
        `/api/mcp/mcps${query ? `?${query}` : ""}`
      );

      if (data.mcps.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No MCP configurations found. Use save_mcp_config to save your project's MCP server configs!",
            },
          ],
        };
      }

      const list = data.mcps
        .map(
          (m) =>
            `- **${m.name}** (${m.id})\n  ${m.description || "No description"}\n  Type: ${m.server_type}${m.command ? ` | Command: ${m.command}` : ""}${m.url ? ` | URL: ${m.url}` : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} MCP config(s):\n\n${list}`,
          },
        ],
      };
    }

    case "get_mcp_config": {
      let config: MCPConfig;

      if (args?.id) {
        config = await apiRequest<MCPConfig>(`/api/mcp/mcps/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ mcps: MCPConfig[] }>(
          `/api/mcp/mcps?limit=100`
        );
        const found = data.mcps.find(
          (m) => m.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return {
            content: [
              {
                type: "text",
                text: `No MCP config found with name "${args.name}"`,
              },
            ],
          };
        }
        config = await apiRequest<MCPConfig>(`/api/mcp/mcps/${found.id}`);
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Please provide either an id or name to get an MCP config.",
            },
          ],
        };
      }

      const parts = [`# ${config.name}`];
      if (config.description) parts.push(`\n*${config.description}*`);

      parts.push(`\n**Server Type:** ${config.server_type}`);
      if (config.command) parts.push(`**Command:** ${config.command}`);
      if (config.url) parts.push(`**URL:** ${config.url}`);
      if (config.provider_url) parts.push(`**Provider:** ${config.provider_url}`);
      if (config.docs_url) parts.push(`**Docs:** ${config.docs_url}`);

      if (config.args) {
        parts.push(
          `\n## Args\n\n\`\`\`json\n${JSON.stringify(config.args, null, 2)}\n\`\`\``
        );
      }

      if (config.env_vars) {
        parts.push(
          `\n## Environment Variables\n\n\`\`\`json\n${JSON.stringify(config.env_vars, null, 2)}\n\`\`\``
        );
      }

      if (config.client_configs) {
        parts.push(
          `\n## Client Configs\n\n\`\`\`json\n${JSON.stringify(config.client_configs, null, 2)}\n\`\`\``
        );
      }

      // Generate ready-to-use .mcp.json snippet
      const mcpEntry: Record<string, unknown> = { type: config.server_type };
      if (config.command) mcpEntry.command = config.command;
      if (config.args) mcpEntry.args = config.args;
      if (config.url) mcpEntry.url = config.url;
      if (config.env_vars) mcpEntry.env = config.env_vars;

      parts.push(
        `\n## .mcp.json Entry\n\n\`\`\`json\n{\n  "mcpServers": {\n    "${config.name}": ${JSON.stringify(mcpEntry, null, 6).replace(/\n/g, "\n    ")}\n  }\n}\n\`\`\``
      );

      if (config.tags && config.tags.length > 0)
        parts.push(`\n**Tags:** ${config.tags.join(", ")}`);

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }

    case "save_mcp_config": {
      if (!args?.name || !args?.server_type) {
        return {
          content: [
            {
              type: "text",
              text: "Name and server_type are required to save an MCP config.",
            },
          ],
        };
      }

      const newConfig = await apiRequest<MCPConfig>("/api/mcp/mcps", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          server_type: args.server_type,
          command: args.command,
          args: args.args,
          url: args.url,
          env_vars: args.env_vars,
          tags: args.tags,
          projects: args.projects,
          provider_url: args.provider_url,
          docs_url: args.docs_url,
          client_configs: args.client_configs,
        }),
      });

      return {
        content: [
          {
            type: "text",
            text: `Saved MCP config "${newConfig.name}" (ID: ${newConfig.id})`,
          },
        ],
      };
    }

    case "delete_mcp_config": {
      if (!args?.id) {
        return {
          content: [
            {
              type: "text",
              text: "MCP config ID is required to delete.",
            },
          ],
        };
      }

      await apiRequest(`/api/mcp/mcps/${args.id}`, { method: "DELETE" });
      return {
        content: [{ type: "text", text: `Deleted MCP config ${args.id}` }],
      };
    }

    default:
      return null;
  }
}
