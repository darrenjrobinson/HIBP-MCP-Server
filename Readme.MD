# Have I Been Pwned MCP Server

A Model Context Protocol (MCP) server for the Have I Been Pwned (HIBP) API that allows you to query breach data using natural language.

## Overview

This MCP server provides tools to interact with the Have I Been Pwned API, allowing you to:

- Check if an email address has been in a data breach
- Get details about specific breaches
- Check if a password has been exposed in known data breaches
- Check if an email address appears in pastes

[GitHub Repo](https://github.com/darrenjrobinson/HIBP-MCP-Server)

[NPM Package](https://www.npmjs.com/package/@darrenjrobinson/hibp-mcp)

[Blog](https://blog.darrenjrobinson.com/a-have-i-been-pwned-mcp-server-for-claude)

<video width="600" controls>
  <source src="./demo/HIBP%20MCP%20Demo.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## Installation & Configuration

### Option 1: NPM Installation (Recommended)

1. Install Node.js (v22.10.0 or higher recommended)
2. Get your HIBP API key from https://haveibeenpwned.com/API/Key
3. Configure your MCP client (e.g., Claude Desktop ) with:

```json
{
  "mcpServers": {
    "HIBP-MCP": {
      "command": "npx",
      "args": ["-y", "@darrenjrobinson/hibp-mcp"],
      "env": {
        "HIBP_API_KEY": "<your-hibp-api-key>",
        "HIBP_SUBSCRIPTION_PLAN": "Pwned 1"
      }
    }
  }
}
```

### Option 2: Local Development

1. Clone this repository:
```bash
git clone https://github.com/darrenjrobinson/HIBP-MCP-Server.git
```
2. Install dependencies:
```bash
cd HIBP-MCP-Server
npm install
```
3. Build the project:
```bash
npm run build
```
4. Configure your MCP client with:
```json
{
  "mcpServers": {
    "HIBP-MCP": {
      "command": "node",
      "args": ["path/to/hibp-mcp/build/main.js"],
      "env": {
        "HIBP_API_KEY": "<your-hibp-api-key>",
        "HIBP_SUBSCRIPTION_PLAN": "Pwned 1"
      }
    }
  }
}
```

### Environment Variables

| Name | Description |
|------|-------------|
| `HIBP_API_KEY` | Your Have I Been Pwned API key |
| `HIBP_SUBSCRIPTION_PLAN` | Your HIBP API subscription plan (Pwned 1, Pwned 2, Pwned 3, Pwned 4, or Pwned 5) |

## Usage Examples

Once configured, you can ask Claude natural language questions about data breaches. Here are some examples:

### Checking Email Breaches
- "Has email address test@example.com appeared in any data breaches?"
- "What breaches contain the email address test@example.com?"
- "Show me all breaches for test@example.com"

### Checking Specific Breaches
- "Tell me about the LinkedIn data breach"
- "What data was exposed in the Adobe breach?"
- "List all known data breaches"

### Checking Passwords
- "Has the password 'Password123' been exposed in any breaches?"
- "Is my password 'MySecurePass2024' safe to use?"
- "Check if this password has been compromised: 'TestPass1234'"

### Checking Pastes
- "Has test@example.com appeared in any pastes?"
- "Show me paste data for test@example.com"

## Tools

### HIBP-Breaches

Query breached accounts and breaches from the Have I Been Pwned API.

Parameters:
- `operation`: The HIBP operation to perform (getAllBreachesForAccount, getAllBreachedSites, getBreachByName, getDataClasses)
- `account`: Email address to check for breaches (required for getAllBreachesForAccount)
- `domain`: Domain to filter breaches by (optional)
- `name`: Breach name to get details for (required for getBreachByName)
- `includeUnverified`: Whether to include unverified breaches (optional)
- `truncateResponse`: Whether to truncate the response (optional)

### HIBP-Pastes

Query pastes containing account data from the Have I Been Pwned API.

Parameters:
- `account`: Email address to check for pastes (required)

### HIBP-PwnedPasswords

Check if a password has been exposed in data breaches using the Pwned Passwords API.

Parameters:
- `password`: Password to check (will be hashed locally before sending and only the first 5 characters sent)

## Security Note

Passwords checked through the HIBP-PwnedPasswords tool are never sent in plain text. They are hashed locally using SHA-1, and only the first 5 characters of the hash are sent to the API using k-anonymity.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

[Darren J Robinson](https://blog.darrenjrobinson.com)
