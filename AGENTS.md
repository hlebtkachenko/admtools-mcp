# AGENTS.md

MCP server for the adm.tools API (ukraine.com.ua / hosting.xyz). TypeScript, Node 22+, stdio transport. Layout and design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

```bash
npm ci
npm run build       # tsc -> dist/
npm test            # build + node:test suite (fake adm.tools API, no credentials needed)
```

## Rules

- adm.tools has no machine-readable spec and its method docs need a login. The contract is the official PHP client (github.com/ukraine-com-ua/API, HostingAPI.class.php). Any change to a request (path, field names) must match it and update the request-shape table in `test/server.test.mjs`.
- `mail/*` endpoints are not in the official client; treat their field names as unverified.
- Every tool needs MCP annotations; destructive and raw tools say so.
- Never call the live API from tests or scripts.
- Synthetic data only in tests and docs (example.com, 192.0.2.x).
- Never commit credentials; configuration is env-only.
- Keep the README tool tables, tool count and env table in sync with the code.
