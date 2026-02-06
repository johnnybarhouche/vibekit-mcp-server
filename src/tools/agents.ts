/**
 * Agent tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  model: string | null;
  provider: string | null;
  temperature: number | null;
  max_tokens: number | null;
  optimized_for: string | null;
  tools: unknown[] | null;
  projects: string[] | null;
  created_at: string;
  updated_at: string;
}

export const agentToolDefinitions = [
  {
    name: "list_agents",
    description:
      "List your saved agent configurations from VibeCodersKit. Returns agent names, models, and IDs.",
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
    name: "get_agent",
    description:
      "Get the full agent configuration by ID or name. Returns system prompt, model settings, and tool definitions. After retrieving, save the result as a {name}.agent.md file in the user's codebase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Agent ID (UUID)" },
        name: {
          type: "string",
          description: "Agent name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_agent",
    description:
      "Save an agent configuration to your VibeCodersKit library. Include the system prompt, model settings, and tool definitions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Agent name" },
        description: { type: "string", description: "What this agent does" },
        system_prompt: { type: "string", description: "The agent's system instruction" },
        model: { type: "string", description: "Model (e.g., 'claude-opus-4-6')" },
        provider: { type: "string", description: "Provider (e.g., 'anthropic')" },
        temperature: { type: "number", description: "Sampling temperature (0-2)" },
        max_tokens: { type: "number", description: "Max output tokens" },
        optimized_for: { type: "string", description: "Use case this agent is optimized for" },
        tools: { type: "array", description: "Tool definitions (JSON array)" },
        projects: {
          type: "array",
          items: { type: "string" },
          description: "Project names to associate with this agent. Always include the current project or repository name.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_agent",
    description: "Delete an agent configuration from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Agent ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handleAgentTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "list_agents": {
      const params = new URLSearchParams();
      if (args?.limit) params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await apiRequest<{ agents: Agent[]; total: number }>(
        `/api/mcp/agents${query ? `?${query}` : ""}`
      );

      if (data.agents.length === 0) {
        return { content: [{ type: "text", text: "No agents found. Save an agent config first!" }] };
      }

      const list = data.agents
        .map(
          (a) =>
            `- **${a.name}** (${a.id})\n  ${a.description || "No description"}${a.model ? `\n  Model: ${a.model}` : ""}${a.optimized_for ? ` | ${a.optimized_for}` : ""}`
        )
        .join("\n\n");

      return { content: [{ type: "text", text: `Found ${data.total} agent(s):\n\n${list}` }] };
    }

    case "get_agent": {
      let agent: Agent;

      if (args?.id) {
        agent = await apiRequest<Agent>(`/api/mcp/agents/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ agents: Agent[] }>(`/api/mcp/agents?limit=100`);
        const found = data.agents.find(
          (a) => a.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return { content: [{ type: "text", text: `No agent found with name "${args.name}"` }] };
        }
        agent = await apiRequest<Agent>(`/api/mcp/agents/${found.id}`);
      } else {
        return { content: [{ type: "text", text: "Please provide either an id or name to get an agent." }] };
      }

      const parts = [`# ${agent.name}`];
      if (agent.description) parts.push(`\n*${agent.description}*`);
      if (agent.model) parts.push(`\n**Model:** ${agent.model}${agent.provider ? ` (${agent.provider})` : ""}`);
      if (agent.temperature !== null) parts.push(`**Temperature:** ${agent.temperature}`);
      if (agent.max_tokens) parts.push(`**Max tokens:** ${agent.max_tokens}`);
      if (agent.optimized_for) parts.push(`**Optimized for:** ${agent.optimized_for}`);
      if (agent.system_prompt) parts.push(`\n## System Prompt\n\n${agent.system_prompt}`);
      if (agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0) {
        parts.push(`\n## Tools\n\n\`\`\`json\n${JSON.stringify(agent.tools, null, 2)}\n\`\`\``);
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }

    case "save_agent": {
      if (!args?.name) {
        return { content: [{ type: "text", text: "Name is required to save an agent." }] };
      }

      const newAgent = await apiRequest<Agent>("/api/mcp/agents", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          system_prompt: args.system_prompt,
          model: args.model,
          provider: args.provider,
          temperature: args.temperature,
          max_tokens: args.max_tokens,
          optimized_for: args.optimized_for,
          tools: args.tools,
          projects: args.projects,
        }),
      });

      return { content: [{ type: "text", text: `Saved agent "${newAgent.name}" (ID: ${newAgent.id})` }] };
    }

    case "delete_agent": {
      if (!args?.id) {
        return { content: [{ type: "text", text: "Agent ID is required to delete." }] };
      }

      await apiRequest(`/api/mcp/agents/${args.id}`, { method: "DELETE" });
      return { content: [{ type: "text", text: `Deleted agent ${args.id}` }] };
    }

    default:
      return null;
  }
}
