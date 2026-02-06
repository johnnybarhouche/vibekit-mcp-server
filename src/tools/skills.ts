/**
 * Skill tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  trigger: string | null;
  content: string | null;
  category: string | null;
  tags: string[] | null;
  projects: string[] | null;
  files: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export const skillToolDefinitions = [
  {
    name: "list_skills",
    description:
      "List your saved skills from VibeCodersKit. Returns skill names, categories, and IDs.",
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
    name: "get_skill",
    description:
      "Get the full skill content by ID or name. Returns trigger, content, and file structure. After retrieving, save the result as a {name}.skill.md file in the user's codebase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Skill ID (UUID)" },
        name: {
          type: "string",
          description: "Skill name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_skill",
    description:
      "Save a skill to your VibeCodersKit library. A skill is a reusable code snippet, automation, or workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Skill name" },
        description: { type: "string", description: "What this skill does" },
        content: { type: "string", description: "Skill code or description" },
        trigger: { type: "string", description: "Activation keyword or pattern" },
        category: { type: "string", description: "Category for organization" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for organization",
        },
        projects: {
          type: "array",
          items: { type: "string" },
          description: "Project names to associate with this skill. Always include the current project or repository name.",
        },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "delete_skill",
    description: "Delete a skill from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Skill ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handleSkillTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "list_skills": {
      const params = new URLSearchParams();
      if (args?.category) params.set("category", String(args.category));
      if (args?.limit) params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await apiRequest<{ skills: Skill[]; total: number }>(
        `/api/mcp/skills${query ? `?${query}` : ""}`
      );

      if (data.skills.length === 0) {
        return { content: [{ type: "text", text: "No skills found. Save some skills first!" }] };
      }

      const list = data.skills
        .map(
          (s) =>
            `- **${s.name}** (${s.id})\n  ${s.description || "No description"}${s.category ? `\n  Category: ${s.category}` : ""}${s.trigger ? ` | Trigger: ${s.trigger}` : ""}${s.projects && s.projects.length > 0 ? `\n  Projects: ${s.projects.join(", ")}` : ""}`
        )
        .join("\n\n");

      return { content: [{ type: "text", text: `Found ${data.total} skill(s):\n\n${list}` }] };
    }

    case "get_skill": {
      let skill: Skill;

      if (args?.id) {
        skill = await apiRequest<Skill>(`/api/mcp/skills/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ skills: Skill[] }>(`/api/mcp/skills?limit=100`);
        const found = data.skills.find(
          (s) => s.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return { content: [{ type: "text", text: `No skill found with name "${args.name}"` }] };
        }
        skill = await apiRequest<Skill>(`/api/mcp/skills/${found.id}`);
      } else {
        return { content: [{ type: "text", text: "Please provide either an id or name to get a skill." }] };
      }

      const parts = [`# ${skill.name}`];
      if (skill.description) parts.push(`\n*${skill.description}*`);
      if (skill.trigger) parts.push(`\n**Trigger:** ${skill.trigger}`);
      if (skill.category) parts.push(`**Category:** ${skill.category}`);
      if (skill.tags && skill.tags.length > 0) parts.push(`**Tags:** ${skill.tags.join(", ")}`);
      if (skill.projects && skill.projects.length > 0) parts.push(`**Projects:** ${skill.projects.join(", ")}`);
      if (skill.content) parts.push(`\n## Content\n\n${skill.content}`);
      if (skill.files && Array.isArray(skill.files) && skill.files.length > 0) {
        parts.push(`\n## Files\n\n\`\`\`json\n${JSON.stringify(skill.files, null, 2)}\n\`\`\``);
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }

    case "save_skill": {
      if (!args?.name || !args?.content) {
        return { content: [{ type: "text", text: "Name and content are required to save a skill." }] };
      }

      const newSkill = await apiRequest<Skill>("/api/mcp/skills", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          content: args.content,
          trigger: args.trigger,
          category: args.category,
          tags: args.tags,
          projects: args.projects,
        }),
      });

      return { content: [{ type: "text", text: `Saved skill "${newSkill.name}" (ID: ${newSkill.id})` }] };
    }

    case "delete_skill": {
      if (!args?.id) {
        return { content: [{ type: "text", text: "Skill ID is required to delete." }] };
      }

      await apiRequest(`/api/mcp/skills/${args.id}`, { method: "DELETE" });
      return { content: [{ type: "text", text: `Deleted skill ${args.id}` }] };
    }

    default:
      return null;
  }
}
