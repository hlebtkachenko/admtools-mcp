import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmClient, Params } from "../adm-client.js";
import { textResult, errorResult } from "./utils.js";

function parseParams(raw: string): Params {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in params: ${raw.slice(0, 100)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("params must be a JSON object");
  }
  return parsed as Params;
}

export function registerBillingTools(server: McpServer, adm: AdmClient, allowRaw: boolean) {
  server.tool("adm_balance", "Get current account balance", {}, { readOnlyHint: true }, async () => {
    try {
      const { response } = await adm.call<{ balance?: number | string }>("billing/balance_get");
      if (response?.balance == null) throw new Error(`billing/balance_get: no balance in response: ${JSON.stringify(response)}`);
      return textResult(`# Account Balance\n\n**${response.balance} UAH**`);
    } catch (err) {
      return errorResult(err);
    }
  });

  if (!allowRaw) return;

  server.tool(
    "adm_api_raw",
    "Call any adm.tools API action with the account token (advanced; can change or delete anything the token can)",
    {
      action: z.string().describe("API action path (e.g. dns/list, billing/balance_get, domain/check)"),
      params: z.string().optional().describe("JSON object of POST parameters; nested objects and arrays are sent as key[sub]=value"),
    },
    { destructiveHint: true, idempotentHint: false, openWorldHint: true },
    async ({ action, params }) => {
      try {
        const parsed = params ? parseParams(params) : undefined;
        const { result, response } = await adm.call(action, parsed, { verifyWith: "the matching read action" });
        return textResult(`# ${action}\n- Result: ${result}\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
