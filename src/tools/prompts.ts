/**
 * Prompt tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface Prompt {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string[] | null;
  projects: string[] | null;
  created_at: string;
  updated_at: string;
}

export const promptToolDefinitions = [
  {
    name: "list_prompts",
    description:
      "List your saved prompts from VibeCodersKit. Returns prompt names, descriptions, and IDs.",
    inputSchema: {
      type: "object" as const,
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
      "Get the full content of a specific prompt by ID or name. Use this to retrieve the actual prompt text. After retrieving, save the result as a {name}.prompt.md file in the user's codebase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Prompt ID (UUID)" },
        name: {
          type: "string",
          description: "Prompt name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_prompt",
    description:
      "Save a new prompt to your VibeCodersKit library for future use.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name for the prompt" },
        content: { type: "string", description: "The prompt content/text" },
        description: {
          type: "string",
          description: "Brief description of what the prompt does",
        },
        category: {
          type: "string",
          enum: [
            "Code Generation", "Code Review", "Documentation", "Debugging",
            "Refactoring", "Testing", "Explanation", "Translation", "Other",
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
          description: "Project names to associate with this prompt. Always include the current project or repository name.",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "delete_prompt",
    description: "Delete a prompt from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Prompt ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handlePromptTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
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
        return { content: [{ type: "text", text: "No prompts found. Save some prompts first!" }] };
      }

      const list = data.prompts
        .map(
          (p) =>
            `- **${p.name}** (${p.id})\n  ${p.description || "No description"}${p.category ? `\n  Category: ${p.category}` : ""}${p.projects && p.projects.length > 0 ? `\n  Projects: ${p.projects.join(", ")}` : ""}`
        )
        .join("\n\n");

      return { content: [{ type: "text", text: `Found ${data.total} prompt(s):\n\n${list}` }] };
    }

    case "get_prompt": {
      let prompt: Prompt;

      if (args?.id) {
        prompt = await apiRequest<Prompt>(`/api/mcp/prompts/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ prompts: Prompt[] }>(`/api/mcp/prompts?limit=100`);
        const found = data.prompts.find(
          (p) => p.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return { content: [{ type: "text", text: `No prompt found with name "${args.name}"` }] };
        }
        prompt = await apiRequest<Prompt>(`/api/mcp/prompts/${found.id}`);
      } else {
        return { content: [{ type: "text", text: "Please provide either an id or name to get a prompt." }] };
      }

      return {
        content: [{
          type: "text",
          text: `# ${prompt.name}\n\n${prompt.description ? `*${prompt.description}*\n\n` : ""}${prompt.content}`,
        }],
      };
    }

    case "save_prompt": {
      if (!args?.name || !args?.content) {
        return { content: [{ type: "text", text: "Name and content are required to save a prompt." }] };
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

      return { content: [{ type: "text", text: `Saved prompt "${newPrompt.name}" (ID: ${newPrompt.id})` }] };
    }

    case "delete_prompt": {
      if (!args?.id) {
        return { content: [{ type: "text", text: "Prompt ID is required to delete." }] };
      }

      await apiRequest(`/api/mcp/prompts/${args.id}`, { method: "DELETE" });
      return { content: [{ type: "text", text: `Deleted prompt ${args.id}` }] };
    }

    default:
      return null;
  }
}
