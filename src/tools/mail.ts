import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AdmClient } from "../adm-client.js";
import { textResult, errorResult } from "./utils.js";

interface MailDomain {
  id: number;
  account_id: number;
  domain: string;
}

interface Mailbox {
  id: string;
  email_auto: string;
  mailbox_type: string;
  forward_to: string | null;
  quota: string;
  size_mb: string;
  check_spam_level: string;
  domain: string;
}

/** Verified list endpoints return { list }; mail/list is unverified, so accept a bare array too. */
function listOf<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  const list = (response as { list?: unknown } | null)?.list;
  if (Array.isArray(list)) return list as T[];
  if (list && typeof list === "object") return Object.values(list) as T[];
  throw new Error(`Unexpected response shape: ${JSON.stringify(response).slice(0, 200)}`);
}

export function registerMailTools(server: McpServer, adm: AdmClient) {
  server.tool("adm_mail_domains", "List all mail domains on your account", {}, { readOnlyHint: true }, async () => {
    try {
      const { response } = await adm.call("mail/list");
      const domains = listOf<MailDomain>(response);
      if (!domains.length) return textResult("No mail domains.");

      const lines = [`# Mail Domains (${domains.length})`, ""];
      for (const d of domains) lines.push(`- **${d.domain}** (mail_id: ${d.id})`);
      return textResult(lines.join("\n"));
    } catch (err) {
      return errorResult(err);
    }
  });

  server.tool(
    "adm_mailboxes",
    "List all mailboxes/redirects for a mail domain",
    { mail_id: z.number().describe("Mail domain ID (from adm_mail_domains)") },
    { readOnlyHint: true },
    async ({ mail_id }) => {
      try {
        const { response } = await adm.call("mail/box/list", { mail_id });
        const boxes = listOf<Mailbox>(response);
        if (!boxes.length) return textResult("No mailboxes.");

        const lines = [`# Mailboxes (${boxes.length})`, ""];
        for (const b of boxes) {
          const fwd = b.forward_to ? ` → ${b.forward_to}` : "";
          const type = b.mailbox_type || "mailbox";
          const size = b.size_mb !== "0" ? ` (${b.size_mb} MB)` : "";
          const spam = b.check_spam_level !== "0" ? ` spam: ${b.check_spam_level}` : "";
          lines.push(`- **${b.email_auto}** [${type}]${fwd}${size}${spam} (id: ${b.id})`);
        }
        return textResult(lines.join("\n"));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.tool(
    "adm_mailbox_delete",
    "Delete a mailbox (careful!)",
    { mail_box_id: z.number().describe("Mailbox ID (from adm_mailboxes)") },
    { destructiveHint: true, idempotentHint: true },
    async ({ mail_box_id }) => {
      try {
        await adm.call("mail/box/delete", { mail_box_id }, { verifyWith: "adm_mailboxes" });
        return textResult(`Mailbox ${mail_box_id} deleted.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
