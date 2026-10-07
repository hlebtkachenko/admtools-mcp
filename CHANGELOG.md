# Changelog

## 3.0.0 (2026-10-07)

- Breaking: `adm_api_raw` is registered only with `ADM_ALLOW_RAW=true`.
- Breaking: `adm_dns_add` no longer offers SRV.
- API responses with `result` false or missing are errors (except `adm_domain_check`); error text from `error`, `messages` or the body.
- Action paths with `..`, query strings or unexpected characters are rejected.
- Nested raw params are encoded PHP-style (`key[sub]=value`).
- Writes with no response report "outcome unknown" and name the read tool to check.
- Mail list tools accept a bare array or `{ list }`.
- MCP annotations on every tool.
- `ADMTOOLS_API_URL` base URL override.
- Tests (node:test, fake API), CI on Node 26; MCP SDK 1.32, zod 4, TypeScript 7, Node 22+.

## 2.0.0 (2026-03-14)

- Initial public release as `admtools-mcp` (renamed from `uua-mcp`)
- 13 tools: domains, DNS, email, billing, raw API
- Security hardening: request timeouts, input sanitization, Zod validation
- MIT license
- Documentation with setup instructions for Cursor, Claude Desktop, Claude Code
