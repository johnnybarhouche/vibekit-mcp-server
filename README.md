# VibeCodersKit MCP Server

Access your [VibeCodersKit](https://vibecoderskit.com) prompt library directly from Claude Code.

## Setup

### 1. Configure Claude Code

Add to your Claude Code MCP settings (`.mcp.json` in your project or `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "vibekit": {
      "command": "npx",
      "args": ["-y", "@vibekit/mcp-server"]
    }
  }
}
```

### 2. Connect your account

```bash
npx @vibekit/mcp-server login
```

This displays a code like `VIBE-XXXX`. Open the URL shown and enter the code to authorize.

### 3. Restart Claude Code

The vibekit tools are now available.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_prompts` | Browse your saved prompts |
| `get_prompt` | Retrieve a prompt by name or ID |
| `save_prompt` | Save a new prompt to your library |
| `delete_prompt` | Remove a prompt |
| `vck_status` | Check connection status and token expiry |
| `vck_logout` | Disconnect and revoke your token |

## Usage Examples

In Claude Code, just say:

- "Show me my saved prompts"
- "Get the prompt called 'Code Review'"
- "Save this conversation as a prompt called 'API Design'"
- "Check my vibekit connection status"

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
    "vibekit": {
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
Run `npx @vibekit/mcp-server login` to connect your account.

**"Authentication expired" error**
Tokens auto-refresh. If refresh fails, run login again.

**Server not appearing in Claude Code**
1. Check your MCP config is valid JSON
2. Restart Claude Code
3. Look for errors in the MCP server output
