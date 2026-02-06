#!/usr/bin/env node
/**
 * VibeCodersKit MCP Server
 *
 * Provides Claude Code access to your saved prompts, agents, skills, and more
 * via the Model Context Protocol.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "./api.js";

// Tool modules
import { promptToolDefinitions, handlePromptTool } from "./tools/prompts.js";
import { agentToolDefinitions, handleAgentTool } from "./tools/agents.js";
import { skillToolDefinitions, handleSkillTool } from "./tools/skills.js";
import { statusToolDefinitions, handleStatusTool } from "./tools/status.js";
import { uiConfigToolDefinitions, handleUIConfigTool } from "./tools/ui-configs.js";
import { stackToolDefinitions, handleStackTool } from "./tools/stacks.js";

// Types for resources
interface Prompt {
  id: string;
  name: string;
  description: string | null;
  content: string;
}

// Create server
const server = new Server(
  {
    name: "vibekit",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools — aggregate from all modules
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      ...promptToolDefinitions,
      ...agentToolDefinitions,
      ...skillToolDefinitions,
      ...uiConfigToolDefinitions,
      ...stackToolDefinitions,
      ...statusToolDefinitions,
    ],
  };
});

// Handle tool calls — route to appropriate module
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Route to the right handler
    const result =
      (await handlePromptTool(name, args as Record<string, unknown>)) ||
      (await handleAgentTool(name, args as Record<string, unknown>)) ||
      (await handleSkillTool(name, args as Record<string, unknown>)) ||
      (await handleUIConfigTool(name, args as Record<string, unknown>)) ||
      (await handleStackTool(name, args as Record<string, unknown>)) ||
      (await handleStatusTool(name, args as Record<string, unknown>));

    if (result) return result;

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
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
  console.error("VibeCodersKit MCP server running (v1.2.0)");
}

// CLI subcommand routing
const subcommand = process.argv[2];

if (subcommand === "login") {
  import("./login.js");
} else if (subcommand === "help" || subcommand === "--help") {
  console.log(`
VibeCodersKit MCP Server

Usage:
  npx vibekit-mcp-server          Start the MCP server (stdio)
  npx vibekit-mcp-server login    Connect your VibeCodersKit account
  npx vibekit-mcp-server help     Show this help message

Tools: list_prompts, get_prompt, save_prompt, delete_prompt,
       list_agents, get_agent, save_agent, delete_agent,
       list_skills, get_skill, save_skill, delete_skill,
       list_ui_configs, get_ui_config, save_ui_config, delete_ui_config,
       list_stacks, get_stack, save_stack, delete_stack,
       vck_status, vck_logout
`);
} else {
  startServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
