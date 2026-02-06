/**
 * Tech Stack tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface TechStack {
  id: string;
  name: string;
  description: string | null;
  frontend: unknown | null;
  backend: unknown | null;
  infrastructure: unknown | null;
  tools: unknown | null;
  notes: string | null;
  projects: string[] | null;
  created_at: string;
  updated_at: string;
}

export const stackToolDefinitions = [
  {
    name: "list_stacks",
    description:
      "List your saved tech stack configurations from VibeCodersKit. Returns stack names, descriptions, and IDs.",
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
    name: "get_stack",
    description:
      "Get a full tech stack configuration by ID or name. Returns frontend, backend, infrastructure, and tools breakdown. After retrieving, save the result as a {name}.stack.md file in the user's codebase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Stack ID (UUID)" },
        name: {
          type: "string",
          description: "Stack name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_stack",
    description:
      "Extract and save the current project's tech stack to VibeCodersKit. Before calling this tool, analyze the project's package.json, config files, and infrastructure setup to identify technologies. Organize findings into four categories: frontend (frameworks, UI libraries, state management), backend (runtime, frameworks, databases, ORMs), infrastructure (hosting, CI/CD, containers, CDN), and tools (linters, formatters, bundlers, testing). Each item should have name, version (if known), and purpose.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Stack name" },
        description: { type: "string", description: "What this stack is for" },
        frontend: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
            required: ["name"],
          },
          description:
            "Frontend technologies (frameworks, UI libraries, state management, CSS). Each item: { name, version?, purpose? }",
        },
        backend: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
            required: ["name"],
          },
          description:
            "Backend technologies (runtime, framework, database, ORM, auth). Each item: { name, version?, purpose? }",
        },
        infrastructure: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
            required: ["name"],
          },
          description:
            "Infrastructure (hosting, CI/CD, containers, CDN, monitoring). Each item: { name, version?, purpose? }",
        },
        tools: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
              purpose: { type: "string" },
            },
            required: ["name"],
          },
          description:
            "Dev tools (linters, formatters, bundlers, testing frameworks). Each item: { name, version?, purpose? }",
        },
        notes: { type: "string", description: "Additional notes about the stack" },
        projects: {
          type: "array",
          items: { type: "string" },
          description:
            "Project names to associate with this stack. Always include the current project or repository name.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_stack",
    description: "Delete a tech stack configuration from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Stack ID to delete" },
      },
      required: ["id"],
    },
  },
];

function formatTechList(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "_None specified_";
  return items
    .map((item: { name: string; version?: string; purpose?: string }) => {
      let line = `- **${item.name}**`;
      if (item.version) line += ` v${item.version}`;
      if (item.purpose) line += ` — ${item.purpose}`;
      return line;
    })
    .join("\n");
}

export async function handleStackTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "list_stacks": {
      const params = new URLSearchParams();
      if (args?.limit) params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await apiRequest<{ stacks: TechStack[]; total: number }>(
        `/api/mcp/stacks${query ? `?${query}` : ""}`
      );

      if (data.stacks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No tech stacks found. Use save_stack to extract and save your project's tech stack!",
            },
          ],
        };
      }

      const list = data.stacks
        .map(
          (s) =>
            `- **${s.name}** (${s.id})\n  ${s.description || "No description"}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} tech stack(s):\n\n${list}`,
          },
        ],
      };
    }

    case "get_stack": {
      let stack: TechStack;

      if (args?.id) {
        stack = await apiRequest<TechStack>(`/api/mcp/stacks/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ stacks: TechStack[] }>(
          `/api/mcp/stacks?limit=100`
        );
        const found = data.stacks.find(
          (s) => s.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return {
            content: [
              {
                type: "text",
                text: `No stack found with name "${args.name}"`,
              },
            ],
          };
        }
        stack = await apiRequest<TechStack>(`/api/mcp/stacks/${found.id}`);
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Please provide either an id or name to get a stack.",
            },
          ],
        };
      }

      const parts = [`# ${stack.name}`];
      if (stack.description) parts.push(`\n*${stack.description}*`);

      parts.push(`\n## Frontend\n\n${formatTechList(stack.frontend)}`);
      parts.push(`\n## Backend\n\n${formatTechList(stack.backend)}`);
      parts.push(`\n## Infrastructure\n\n${formatTechList(stack.infrastructure)}`);
      parts.push(`\n## Tools\n\n${formatTechList(stack.tools)}`);

      if (stack.notes) parts.push(`\n## Notes\n\n${stack.notes}`);

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }

    case "save_stack": {
      if (!args?.name) {
        return {
          content: [
            {
              type: "text",
              text: "Name is required to save a tech stack.",
            },
          ],
        };
      }

      const newStack = await apiRequest<TechStack>("/api/mcp/stacks", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          frontend: args.frontend,
          backend: args.backend,
          infrastructure: args.infrastructure,
          tools: args.tools,
          notes: args.notes,
          projects: args.projects,
        }),
      });

      return {
        content: [
          {
            type: "text",
            text: `Saved tech stack "${newStack.name}" (ID: ${newStack.id})`,
          },
        ],
      };
    }

    case "delete_stack": {
      if (!args?.id) {
        return {
          content: [
            {
              type: "text",
              text: "Stack ID is required to delete.",
            },
          ],
        };
      }

      await apiRequest(`/api/mcp/stacks/${args.id}`, { method: "DELETE" });
      return {
        content: [{ type: "text", text: `Deleted stack ${args.id}` }],
      };
    }

    default:
      return null;
  }
}
