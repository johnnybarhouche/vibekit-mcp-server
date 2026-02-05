# VibeCodersKit MCP Server

Access your VibeCodersKit prompts directly from Claude Code.

## Quick Setup

### 1. Build the server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Connect your account

```bash
node dist/login.js
```

This will display a code like `VIBE-XXXX`. Open the URL shown and enter the code to authorize.

### 3. Configure Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "vibekit": {
      "command": "node",
      "args": ["/path/to/vibekit/mcp-server/dist/index.js"]
    }
  }
}
```

Or for development with a local server:

```json
{
  "mcpServers": {
    "vibekit": {
      "command": "node",
      "args": ["/path/to/vibekit/mcp-server/dist/index.js"],
      "env": {
        "VIBEKIT_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 4. Restart Claude Code

The vibekit tools will now be available:
- `list_prompts` - View your saved prompts
- `get_prompt` - Get prompt content by name or ID
- `save_prompt` - Save new prompts to your library
- `delete_prompt` - Remove a prompt

## Usage Examples

In Claude Code, you can now say:

- "Show me my prompts"
- "Get the prompt called 'Code Review'"
- "Save this as a prompt for future use"

## Troubleshooting

**"Not authenticated" error**
Run `node dist/login.js` to reconnect your account.

**"Authentication expired" error**
Your token has expired. Run login again to get a new token.

**Server not appearing in Claude Code**
1. Check the path in settings.json is correct
2. Ensure the server is built (`npm run build`)
3. Restart Claude Code
