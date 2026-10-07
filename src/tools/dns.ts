import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmClient } from "../adm-client.js";
import { textResult, errorResult } from "./utils.js";

interface DnsRecord {
  type?: string;
  record?: string;
  name?: string;
  data?: string;
  value?: string;
  priority?: number;
  id?: string;
}

export function registerDnsTools(server: McpServer, adm: AdmClient) {
  server.tool(
    "adm_dns_records",
    "List all DNS records for a domain",
    { domain_id: z.number().describe("Domain ID (from adm_domains)") },
    { readOnlyHint: true },
    async ({ domain_id }) => {
      try {
        const { response } = await adm.call<{ list: DnsRecord[] }>("dns/records_list", { domain_id });
        const records = response.list;
        if (!records?.length) return textResult("No DNS records.");

        const lines = [`# DNS Records (${records.length})`, ""];
        for (const r of records) {
          const type = r.type || "?";
          const name = r.record || r.name || "@";
          const data = r.data || r.value || "";
          const prio = r.priority ? ` (priority: ${r.priority})` : "";
          lines.push(`- **${type}** ${name} → ${data}${prio} (id: ${r.id || "?"})`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "adm_dns_add",
    "Add a DNS record to a domain",
    {
      domain_id: z.number().describe("Domain ID"),
      type: z.enum(["A", "AAAA", "ALIAS", "CAA", "CNAME", "MX", "NS", "TXT"]).describe("Record type"),
      record: z.string().describe("Subdomain name (@ for root, www, mail, etc.)"),
      data: z.string().describe("Record value (IP, hostname, text)"),
      priority: z.number().optional().default(0).describe("Priority (for MX records)"),
    },
    { destructiveHint: false, idempotentHint: false },
    async ({ domain_id, type, record, data, priority }) => {
      try {
        await adm.call("dns/record_add", { domain_id, type, record, priority, data }, { verifyWith: "adm_dns_records" });
        return textResult(`DNS record added: ${type} ${record} → ${data}`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "adm_dns_delete",
    "Delete a DNS record (careful!)",
    { subdomain_id: z.number().describe("DNS record ID (from adm_dns_records)") },
    { destructiveHint: true, idempotentHint: true },
    async ({ subdomain_id }) => {
      try {
        await adm.call("dns/record_delete", { subdomain_id }, { verifyWith: "adm_dns_records" });
        return textResult(`DNS record ${subdomain_id} deleted.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
