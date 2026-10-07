import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmClient } from "../adm-client.js";
import { textResult, errorResult } from "./utils.js";

interface DomainInfo {
  domain_id?: string;
  id?: string;
  expired?: string | boolean;
  pending_delete?: boolean;
  domain_paid?: string;
  valid_untill_formatted?: string;
  valid_untill?: string;
}

interface ZoneInfo {
  zone?: string;
  name?: string;
  price_register?: string;
  price?: string;
}

export function registerDomainTools(server: McpServer, adm: AdmClient) {
  server.tool("adm_domains", "List all domains in your account", {}, { readOnlyHint: true }, async () => {
    try {
      const { response } = await adm.call<{ list: Record<string, DomainInfo> }>("dns/list");
      const domains = response.list;
      if (!domains || !Object.keys(domains).length) {
        return textResult("No domains found.");
      }

      const lines = [`# Domains (${Object.keys(domains).length})`, ""];
      for (const [name, info] of Object.entries(domains)) {
        const id = info.domain_id ?? info.id ?? "?";
        const expired = info.expired === "1" || info.expired === true;
        const pending = info.pending_delete === true;
        const paid = info.domain_paid === "1";
        const expiry = info.valid_untill_formatted || info.valid_untill || "";

        let status = "UNKNOWN";
        if (pending) status = "PENDING DELETE";
        else if (expired) status = "EXPIRED";
        else if (paid) status = "ACTIVE";

        lines.push(`- **${name}** (id: ${id}) [${status}]${expiry ? ` expires: ${expiry}` : ""}`);
      }
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool(
    "adm_domain_check",
    "Check if a domain name is available for registration",
    { domain: z.string().describe("Domain to check (e.g. example.com.ua)") },
    { readOnlyHint: true },
    async ({ domain }) => {
      try {
        const { result, response } = await adm.call<Record<string, unknown>>("domain/check", { domain }, { allowFalseResult: true });
        const lines = [`# Domain check: ${domain}`, `- Available: ${result ? "YES" : "NO"}`];
        if (response && typeof response === "object") {
          for (const [k, v] of Object.entries(response)) {
            if (v != null && v !== "") lines.push(`- ${k}: ${v}`);
          }
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool("adm_domain_zones", "List available domain zones with prices", {}, { readOnlyHint: true }, async () => {
    try {
      const { response } = await adm.call<{ list: ZoneInfo[] }>("domain/zones");
      const zones = response.list;
      if (!zones?.length) return textResult("No zones.");

      const lines = [`# Available Zones (${zones.length})`, ""];
      for (const zone of zones.slice(0, 50)) {
        lines.push(`- .${zone.zone || zone.name || "?"} ${zone.price_register || zone.price ? `— ${zone.price_register || zone.price} UAH` : ""}`);
      }
      if (zones.length > 50) lines.push(`\n... and ${zones.length - 50} more`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool(
    "adm_domain_add",
    "Add a domain to NS servers (for DNS management)",
    { domain_name: z.string().describe("Domain name to add") },
    { destructiveHint: false, idempotentHint: false },
    async ({ domain_name }) => {
      try {
        const { response } = await adm.call<{ domain_id: number }>("dns/add_foreign_domain", { domain_name }, { verifyWith: "adm_domains" });
        return textResult(`Domain added. ID: ${response.domain_id}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "adm_get_id",
    "Get object ID by type and name (utility)",
    {
      type: z.string().describe("Object type (e.g. domain, hosting)"),
      name: z.string().describe("Object name"),
    },
    { readOnlyHint: true },
    async ({ type, name }) => {
      try {
        const { response } = await adm.call<Record<string, unknown>>("get_id", { type, name });
        const values = Object.values(response);
        if (!values.length) {
          return textResult(`No ID found for ${type}/${name}`);
        }
        const id = values[0];
        return textResult(`ID for ${type}/${name}: ${id}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
