# [adm.tools](https://adm.tools) (service from [hosting.xyz](https://hosting.xyz) / [ukraine.com.ua](https://ukraine.com.ua)) MCP Server

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue)

MCP server for [adm.tools](https://adm.tools) — the management panel behind [ukraine.com.ua](https://ukraine.com.ua) and [hosting.xyz](https://hosting.xyz) hosting platforms. Manage domains, DNS records, email, and billing from any MCP-compatible client.

12 tools for the adm.tools API, plus `adm_api_raw` when `ADM_ALLOW_RAW=true`.

## Requirements

- Node.js 22+
- adm.tools API token (activate at [adm.tools/user/api](https://adm.tools/user/api/))

## Installation

```bash
git clone https://github.com/hlebtkachenko/admtools-mcp.git
cd admtools-mcp
npm ci
npm run build
```

## Configuration

### Cursor

`~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "admtools": {
      "command": "node",
      "args": ["/path/to/admtools-mcp/dist/index.js"],
      "env": {
        "ADMTOOLS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json` ([location](https://modelcontextprotocol.io/quickstart/user#1-open-your-mcp-client))

```json
{
  "mcpServers": {
    "admtools": {
      "command": "node",
      "args": ["/path/to/admtools-mcp/dist/index.js"],
      "env": {
        "ADMTOOLS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Claude Code

`.mcp.json` in your project root, or `~/.claude.json` globally:

```json
{
  "mcpServers": {
    "admtools": {
      "command": "node",
      "args": ["/path/to/admtools-mcp/dist/index.js"],
      "env": {
        "ADMTOOLS_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### Any MCP client (stdio)

The server uses `stdio` transport. Point your MCP client to:

```
node /path/to/admtools-mcp/dist/index.js
```

With the `ADMTOOLS_API_TOKEN` environment variable set.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMTOOLS_API_TOKEN` | Yes | Bearer token from [adm.tools API settings](https://adm.tools/user/api/) |
| `ADM_ALLOW_RAW` | No | Set to `true` to register `adm_api_raw` (any API action with the account-wide token) |
| `ADMTOOLS_API_URL` | No | API base URL, default `https://adm.tools/action` (tests point it at a fake server) |

## Tools

### Domains

| Tool | Description |
|------|-------------|
| `adm_domains` | List all domains with status and expiry |
| `adm_domain_check` | Check domain availability for registration |
| `adm_domain_zones` | Available zones with registration prices |
| `adm_domain_add` | Add domain to NS servers for DNS management |
| `adm_get_id` | Get object ID by type and name |

### DNS

| Tool | Description |
|------|-------------|
| `adm_dns_records` | List DNS records for a domain |
| `adm_dns_add` | Add record (A, AAAA, ALIAS, CAA, CNAME, MX, NS, TXT) |
| `adm_dns_delete` | Delete a DNS record |

### Email

| Tool | Description |
|------|-------------|
| `adm_mail_domains` | List all mail domains |
| `adm_mailboxes` | List mailboxes and redirects for a domain |
| `adm_mailbox_delete` | Delete a mailbox |

### Billing

| Tool | Description |
|------|-------------|
| `adm_balance` | Current account balance (UAH) |

### Raw API

| Tool | Description |
|------|-------------|
| `adm_api_raw` | Call any adm.tools API action directly. Registered only with `ADM_ALLOW_RAW=true`; marked destructive |

The `mail/*` endpoints are not in the official client, so their parameter names (`mail_id`, `mail_box_id`) are unverified.

## Security

- 30-second timeout on all HTTP requests; no automatic retries. A write that gets no response is reported as "outcome unknown" with the read tool to check
- Any response with `result` false or missing is returned as an error (except `adm_domain_check`, where false means "not available")
- Action paths must be `/`-separated segments of letters, digits, `_` and `-`; `..`, query strings and empty paths are rejected
- `adm_api_raw` is off unless `ADM_ALLOW_RAW=true`; its `params` must be a JSON object
- Tool arguments are validated with Zod schemas; `adm_api_raw` params are free-form

## Architecture

```
src/
  index.ts          Entry point, env validation
  adm-client.ts     API client (Bearer auth, form-encoded POST, result check)
  tools/
    domains.ts      Domain management (5 tools)
    dns.ts          DNS records (3 tools)
    mail.ts         Email management (3 tools)
    billing.ts      Balance, plus raw API when enabled (1-2 tools)
test/               node:test suite against a fake adm.tools API
```

## Tech Stack

- TypeScript
- `@modelcontextprotocol/sdk`
- Zod (schema validation)
- Native `fetch`

## What is adm.tools?

[adm.tools](https://adm.tools) is the hosting management panel used by Ukrainian hosting providers [ukraine.com.ua](https://ukraine.com.ua) and [hosting.xyz](https://hosting.xyz). It provides a unified API for domain registration, DNS management, email, and billing across both platforms.

## API Reference

- [adm.tools API](https://adm.tools/user/api/) (requires login)
- [Official PHP client](https://github.com/ukraine-com-ua/API)
- [Wiki](https://ukraine.com.ua/wiki/account/api/)

## License

[MIT](LICENSE)
