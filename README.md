# VibeCodersKit MCP Server

Access your [VibeCodersKit](https://vibecoderskit.ai) library directly from Claude Code — prompts, agents, skills, UI configs, tech stacks, and MCP server configurations.

## Setup

### 1. Configure Claude Code

Add to your Claude Code MCP settings (`.mcp.json` in your project or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "vibecoderskit": {
      "command": "npx",
      "args": ["-y", "vibecoderskit-mcp-server"]
    }
  }
}
```

### 2. Connect your account

```bash
npx vibecoderskit-mcp-server login
```

This displays a code like `VIBE-XXXX`. Open the URL shown and enter the code to authorize.

### 3. Restart Claude Code

The VibeCodersKit tools are now available.

## Available Tools

### Prompts
| Tool | Description |
|------|-------------|
| `list_prompts` | Browse your saved prompts |
| `get_prompt` | Retrieve a prompt by name or ID |
| `save_prompt` | Save a new prompt to your library |
| `delete_prompt` | Remove a prompt |

### Agents
| Tool | Description |
|------|-------------|
| `list_agents` | Browse your saved agents |
| `get_agent` | Retrieve an agent by name or ID |
| `save_agent` | Save a new agent configuration |
| `delete_agent` | Remove an agent |

### Skills
| Tool | Description |
|------|-------------|
| `list_skills` | Browse your saved skills |
| `get_skill` | Retrieve a skill by name or ID |
| `save_skill` | Save a new skill |
| `delete_skill` | Remove a skill |

### UI/UX Configurations
| Tool | Description |
|------|-------------|
| `list_ui_configs` | Browse your UI/UX configs |
| `get_ui_config` | Retrieve a UI/UX config by name or ID |
| `save_ui_config` | Extract and save UI/UX guidelines from a project |
| `delete_ui_config` | Remove a UI/UX config |

### Tech Stacks
| Tool | Description |
|------|-------------|
| `list_stacks` | Browse your tech stack definitions |
| `get_stack` | Retrieve a tech stack by name or ID |
| `save_stack` | Extract and save a project's tech stack |
| `delete_stack` | Remove a tech stack |

### MCP Server Configurations
| Tool | Description |
|------|-------------|
| `list_mcp_configs` | Browse your saved MCP server configs |
| `get_mcp_config` | Retrieve an MCP config with ready-to-use `.mcp.json` snippet |
| `save_mcp_config` | Save an MCP server configuration from your project |
| `delete_mcp_config` | Remove an MCP config |

### Status
| Tool | Description |
|------|-------------|
| `vck_status` | Check connection status and token expiry |
| `vck_logout` | Disconnect and revoke your token |

## Usage Examples

In Claude Code, just say:

- "Show me my saved prompts"
- "Get the agent called 'Code Reviewer'"
- "Save this project's UI/UX guidelines to VibeCodersKit"
- "Extract this project's tech stack and save it"
- "Save my MCP server configs to VibeCodersKit"
- "Get my MCP config for 'github' and add it to this project"

## Development

```bash
git clone https://github.com/vibecoderskit/mcp-server.git
cd mcp-server
npm install
npm run build
```

For local development, point to your local API:

```json
{
  "mcpServers": {
    "vibecoderskit": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "VIBEKIT_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

## Troubleshooting

**"Not authenticated" error**
Run `npx vibecoderskit-mcp-server login` to connect your account.

**"Authentication expired" error**
Tokens auto-refresh. If refresh fails, run login again.

**Server not appearing in Claude Code**
1. Check your MCP config is valid JSON
2. Restart Claude Code
3. Look for errors in the MCP server output
