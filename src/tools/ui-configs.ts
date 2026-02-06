/**
 * UI/UX Configuration tools — list, get, save, delete
 */

import { apiRequest } from "../api.js";

interface UIConfig {
  id: string;
  name: string;
  description: string | null;
  design_system: string | null;
  color_palette: unknown | null;
  typography: unknown | null;
  component_library: string | null;
  icon_library: string | null;
  styling_approach: string | null;
  spacing_scale: unknown | null;
  border_radius: string | null;
  theme_mode: string | null;
  animations_enabled: boolean;
  motion_preference: string | null;
  accessibility_level: string | null;
  focus_indicators: boolean;
  custom_css: string | null;
  notes: string | null;
  tags: string[] | null;
  projects: string[] | null;
  created_at: string;
  updated_at: string;
}

export const uiConfigToolDefinitions = [
  {
    name: "list_ui_configs",
    description:
      "List your saved UI/UX configurations from VibeCodersKit. Returns config names, design systems, and IDs.",
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
    name: "get_ui_config",
    description:
      "Get a full UI/UX configuration by ID or name. Returns design system, colors, typography, component library, and all styling preferences. After retrieving, save the result as a {name}.ui-config.md file in the user's codebase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UI config ID (UUID)" },
        name: {
          type: "string",
          description: "Config name (will search if ID not provided)",
        },
      },
    },
  },
  {
    name: "save_ui_config",
    description:
      "Extract and save the current project's UI/UX guidelines to VibeCodersKit. Before calling this tool, analyze the project's codebase to extract: design system (Tailwind, etc.), color palette from config files, typography settings, component library (shadcn, etc.), icon library, styling approach, spacing scale, border radius tokens, theme mode, and accessibility settings. Package all findings into the structured fields below.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Configuration name" },
        description: { type: "string", description: "What this UI/UX config covers" },
        design_system: {
          type: "string",
          description: "Design system used (e.g., 'Tailwind CSS', 'Material Design', 'Custom')",
        },
        color_palette: {
          type: "object",
          description:
            "Color palette extracted from the project. Object with color names as keys and hex values as values (e.g., { primary: '#6B46C1', secondary: '#4A5568', background: '#FFFFFF' })",
        },
        typography: {
          type: "object",
          description:
            "Typography settings (e.g., { fontFamily: 'Inter', headingFont: 'Cal Sans', baseFontSize: '16px', scale: 'major-third' })",
        },
        component_library: {
          type: "string",
          description: "Component library used (e.g., 'shadcn/ui', 'HeroUI', 'Material UI', 'Headless UI')",
        },
        icon_library: {
          type: "string",
          description: "Icon library (e.g., 'Lucide', 'Heroicons', 'Phosphor')",
        },
        styling_approach: {
          type: "string",
          description: "Styling approach (e.g., 'Utility-first CSS', 'CSS Modules', 'CSS-in-JS', 'Styled Components')",
        },
        spacing_scale: {
          type: "object",
          description:
            "Spacing scale tokens (e.g., { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' })",
        },
        border_radius: {
          type: "string",
          description: "Default border radius (e.g., '0.5rem', '8px', 'rounded-lg')",
        },
        theme_mode: {
          type: "string",
          enum: ["light", "dark", "system"],
          description: "Default theme mode",
        },
        animations_enabled: {
          type: "boolean",
          description: "Whether animations are used in the project",
        },
        accessibility_level: {
          type: "string",
          description: "Accessibility standard (e.g., 'WCAG AA', 'WCAG AAA')",
        },
        custom_css: {
          type: "string",
          description: "Any notable custom CSS patterns or global styles",
        },
        notes: {
          type: "string",
          description: "Additional notes about the UI/UX approach",
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
      required: ["name"],
    },
  },
  {
    name: "delete_ui_config",
    description: "Delete a UI/UX configuration from your library by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UI config ID to delete" },
      },
      required: ["id"],
    },
  },
];

export async function handleUIConfigTool(
  name: string,
  args: Record<string, unknown> | undefined
) {
  switch (name) {
    case "list_ui_configs": {
      const params = new URLSearchParams();
      if (args?.limit) params.set("limit", String(args.limit));

      const query = params.toString();
      const data = await apiRequest<{ ui_configs: UIConfig[]; total: number }>(
        `/api/mcp/ui-configs${query ? `?${query}` : ""}`
      );

      if (data.ui_configs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No UI/UX configurations found. Use save_ui_config to extract and save your project's UI guidelines!",
            },
          ],
        };
      }

      const list = data.ui_configs
        .map(
          (c) =>
            `- **${c.name}** (${c.id})\n  ${c.description || "No description"}${c.design_system ? `\n  Design system: ${c.design_system}` : ""}${c.component_library ? ` | Components: ${c.component_library}` : ""}${c.projects && c.projects.length > 0 ? `\n  Projects: ${c.projects.join(", ")}` : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} UI/UX config(s):\n\n${list}`,
          },
        ],
      };
    }

    case "get_ui_config": {
      let config: UIConfig;

      if (args?.id) {
        config = await apiRequest<UIConfig>(`/api/mcp/ui-configs/${args.id}`);
      } else if (args?.name) {
        const data = await apiRequest<{ ui_configs: UIConfig[] }>(
          `/api/mcp/ui-configs?limit=100`
        );
        const found = data.ui_configs.find(
          (c) => c.name.toLowerCase() === String(args.name).toLowerCase()
        );
        if (!found) {
          return {
            content: [
              {
                type: "text",
                text: `No UI config found with name "${args.name}"`,
              },
            ],
          };
        }
        config = await apiRequest<UIConfig>(
          `/api/mcp/ui-configs/${found.id}`
        );
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Please provide either an id or name to get a UI config.",
            },
          ],
        };
      }

      const parts = [`# ${config.name}`];
      if (config.description) parts.push(`\n*${config.description}*`);

      // Design system section
      const designParts: string[] = [];
      if (config.design_system) designParts.push(`**Design System:** ${config.design_system}`);
      if (config.component_library) designParts.push(`**Component Library:** ${config.component_library}`);
      if (config.icon_library) designParts.push(`**Icon Library:** ${config.icon_library}`);
      if (config.styling_approach) designParts.push(`**Styling:** ${config.styling_approach}`);
      if (config.theme_mode) designParts.push(`**Theme:** ${config.theme_mode}`);
      if (designParts.length > 0) parts.push(`\n## Design System\n\n${designParts.join("\n")}`);

      // Color palette
      if (config.color_palette) {
        parts.push(`\n## Color Palette\n\n\`\`\`json\n${JSON.stringify(config.color_palette, null, 2)}\n\`\`\``);
      }

      // Typography
      if (config.typography) {
        parts.push(`\n## Typography\n\n\`\`\`json\n${JSON.stringify(config.typography, null, 2)}\n\`\`\``);
      }

      // Spacing
      if (config.spacing_scale) {
        parts.push(`\n## Spacing Scale\n\n\`\`\`json\n${JSON.stringify(config.spacing_scale, null, 2)}\n\`\`\``);
      }

      if (config.border_radius) parts.push(`\n**Border Radius:** ${config.border_radius}`);

      // Accessibility
      const a11yParts: string[] = [];
      if (config.accessibility_level) a11yParts.push(`**Level:** ${config.accessibility_level}`);
      a11yParts.push(`**Animations:** ${config.animations_enabled ? "enabled" : "disabled"}`);
      a11yParts.push(`**Focus Indicators:** ${config.focus_indicators ? "enabled" : "disabled"}`);
      if (config.motion_preference) a11yParts.push(`**Motion:** ${config.motion_preference}`);
      parts.push(`\n## Accessibility\n\n${a11yParts.join("\n")}`);

      if (config.custom_css) parts.push(`\n## Custom CSS\n\n\`\`\`css\n${config.custom_css}\n\`\`\``);
      if (config.notes) parts.push(`\n## Notes\n\n${config.notes}`);
      if (config.tags && config.tags.length > 0) parts.push(`\n**Tags:** ${config.tags.join(", ")}`);
      if (config.projects && config.projects.length > 0) parts.push(`**Projects:** ${config.projects.join(", ")}`);

      return { content: [{ type: "text", text: parts.join("\n") }] };
    }

    case "save_ui_config": {
      if (!args?.name) {
        return {
          content: [
            {
              type: "text",
              text: "Name is required to save a UI config.",
            },
          ],
        };
      }

      const newConfig = await apiRequest<UIConfig>("/api/mcp/ui-configs", {
        method: "POST",
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          design_system: args.design_system,
          color_palette: args.color_palette,
          typography: args.typography,
          component_library: args.component_library,
          icon_library: args.icon_library,
          styling_approach: args.styling_approach,
          spacing_scale: args.spacing_scale,
          border_radius: args.border_radius,
          theme_mode: args.theme_mode,
          animations_enabled: args.animations_enabled,
          accessibility_level: args.accessibility_level,
          custom_css: args.custom_css,
          notes: args.notes,
          tags: args.tags,
          projects: args.projects,
        }),
      });

      return {
        content: [
          {
            type: "text",
            text: `Saved UI/UX config "${newConfig.name}" (ID: ${newConfig.id})`,
          },
        ],
      };
    }

    case "delete_ui_config": {
      if (!args?.id) {
        return {
          content: [
            {
              type: "text",
              text: "UI config ID is required to delete.",
            },
          ],
        };
      }

      await apiRequest(`/api/mcp/ui-configs/${args.id}`, {
        method: "DELETE",
      });
      return {
        content: [{ type: "text", text: `Deleted UI config ${args.id}` }],
      };
    }

    default:
      return null;
  }
}
