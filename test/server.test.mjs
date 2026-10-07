// End-to-end tests: the built server (dist/) talks to a fake adm.tools API over HTTP.
// Run with `npm test` (builds first). All data here is synthetic.
// adm.tools publishes no machine-readable spec; request shapes are pinned to the
// official PHP client (github.com/ukraine-com-ua/API, HostingAPI.class.php).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const TOKEN = "test-token";
const ok = (response) => ({ result: true, response });

const DEFAULTS = {
  "/dns/list/": ok({ list: { "example.com": { domain_id: "1", expired: "0", domain_paid: "1", valid_untill: "2027-01-01" } } }),
  "/domain/check/": { result: false, response: { price: "100" } },
  "/domain/zones/": ok({ list: [{ zone: "com", price_register: "300" }] }),
  "/dns/add_foreign_domain/": ok({ domain_id: 42 }),
  "/get_id/": ok({ id: 7 }),
  "/dns/records_list/": ok({ list: [{ id: "9", type: "A", record: "@", data: "192.0.2.1" }] }),
  "/dns/record_add/": ok([]),
  "/dns/record_delete/": ok([]),
  "/billing/balance_get/": ok({ balance: "123.45" }),
  "/mail/list/": ok({ list: [{ id: 5, account_id: 1, domain: "example.com" }] }),
  "/mail/box/list/": ok({ list: [{ id: "11", email_auto: "info@example.com", mailbox_type: "mailbox", forward_to: null, quota: "0", size_mb: "0", check_spam_level: "0", domain: "example.com" }] }),
  "/mail/box/delete/": ok([]),
};

let requests = [];
let nextReply = null; // one-shot override: { status, body } | "destroy"
let server;
let client;

const last = () => requests.at(-1);

function connect(env) {
  const c = new Client({ name: "test", version: "0" });
  return c
    .connect(new StdioClientTransport({
      command: process.execPath,
      args: ["dist/index.js"],
      env: { ADMTOOLS_API_TOKEN: TOKEN, ADMTOOLS_API_URL: `http://127.0.0.1:${server.address().port}`, ...env },
    }))
    .then(() => c);
}

before(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({
        method: req.method,
        path: req.url,
        auth: req.headers.authorization,
        contentType: req.headers["content-type"],
        body,
        form: Object.fromEntries(new URLSearchParams(body)),
      });
      const reply = nextReply;
      nextReply = null;
      if (reply === "destroy") return req.socket.destroy();
      const status = reply?.status ?? 200;
      const payload = reply ? reply.body : DEFAULTS[req.url] ?? { result: false, error: "unknown action" };
      res.writeHead(status, { "Content-Type": "application/json" })
        .end(typeof payload === "string" ? payload : JSON.stringify(payload));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  client = await connect({ ADM_ALLOW_RAW: "true" });
});

after(async () => {
  await client?.close();
  server?.close();
});

const call = async (name, args = {}) => {
  requests = [];
  return client.callTool({ name, arguments: args });
};
const text = (r) => r.content.map((c) => c.text).join("\n");

// tool, arguments, expected path, expected form body (exact field names and values)
const SHAPES = [
  ["adm_domains", {}, "/dns/list/", {}],
  ["adm_domain_check", { domain: "example.com" }, "/domain/check/", { domain: "example.com" }],
  ["adm_domain_zones", {}, "/domain/zones/", {}],
  ["adm_domain_add", { domain_name: "example.com" }, "/dns/add_foreign_domain/", { domain_name: "example.com" }],
  ["adm_get_id", { type: "domain", name: "example.com" }, "/get_id/", { type: "domain", name: "example.com" }],
  ["adm_dns_records", { domain_id: 1 }, "/dns/records_list/", { domain_id: "1" }],
  ["adm_dns_add", { domain_id: 1, type: "MX", record: "@", data: "mail.example.com", priority: 10 }, "/dns/record_add/",
    { domain_id: "1", type: "MX", record: "@", priority: "10", data: "mail.example.com" }],
  ["adm_dns_add", { domain_id: 1, type: "A", record: "www", data: "192.0.2.1" }, "/dns/record_add/",
    { domain_id: "1", type: "A", record: "www", priority: "0", data: "192.0.2.1" }],
  ["adm_dns_delete", { subdomain_id: 9 }, "/dns/record_delete/", { subdomain_id: "9" }],
  ["adm_balance", {}, "/billing/balance_get/", {}],
  // mail/* field names are not in the official client and remain unverified.
  ["adm_mail_domains", {}, "/mail/list/", {}],
  ["adm_mailboxes", { mail_id: 5 }, "/mail/box/list/", { mail_id: "5" }],
  ["adm_mailbox_delete", { mail_box_id: 11 }, "/mail/box/delete/", { mail_box_id: "11" }],
  ["adm_api_raw", { action: "dns/records_list", params: '{"domain_id":1}' }, "/dns/records_list/", { domain_id: "1" }],
];

for (const [tool, args, path, form] of SHAPES) {
  test(`${tool} sends POST ${path} with ${JSON.stringify(form)}`, async () => {
    const r = await call(tool, args);
    assert.ok(!r.isError, text(r));
    assert.equal(requests.length, 1);
    const req = last();
    assert.equal(req.method, "POST");
    assert.equal(req.path, path);
    assert.equal(req.auth, `Bearer ${TOKEN}`);
    assert.equal(req.contentType, "application/x-www-form-urlencoded");
    assert.deepEqual(req.form, form);
  });
}

test("every tool carries MCP annotations", async () => {
  const tools = Object.fromEntries((await client.listTools()).tools.map((t) => [t.name, t.annotations ?? {}]));
  assert.equal(Object.keys(tools).length, 13);
  for (const n of ["adm_domains", "adm_domain_check", "adm_domain_zones", "adm_get_id", "adm_dns_records", "adm_balance", "adm_mail_domains", "adm_mailboxes"]) {
    assert.equal(tools[n].readOnlyHint, true, n);
  }
  for (const n of ["adm_dns_delete", "adm_mailbox_delete", "adm_api_raw"]) assert.equal(tools[n].destructiveHint, true, n);
  for (const n of ["adm_dns_add", "adm_domain_add"]) assert.equal(tools[n].destructiveHint, false, n);
  assert.equal(tools.adm_dns_add.idempotentHint, false);
  assert.equal(tools.adm_dns_delete.idempotentHint, true);
  assert.equal(tools.adm_api_raw.openWorldHint, true);
});

// Finding 1: result:false without an error key must not read as success.
for (const [tool, args] of [
  ["adm_dns_add", { domain_id: 1, type: "A", record: "www", data: "192.0.2.1" }],
  ["adm_dns_delete", { subdomain_id: 9 }],
  ["adm_mailbox_delete", { mail_box_id: 11 }],
  ["adm_domain_add", { domain_name: "example.com" }],
  ["adm_balance", {}],
]) {
  test(`${tool} reports result:false without error key as an error`, async () => {
    nextReply = { body: { result: false, response: [] } };
    const r = await call(tool, args);
    assert.equal(r.isError, true, text(r));
  });
}

test("API error text comes from error, then messages, then the raw body", async () => {
  nextReply = { body: { result: false, error: "Synthetic error" } };
  assert.match(text(await call("adm_balance")), /Synthetic error/);
  nextReply = { body: { result: false, messages: { error: ["Synthetic message"] } } };
  assert.match(text(await call("adm_balance")), /Synthetic message/);
  nextReply = { body: { result: false, response: [] } };
  assert.match(text(await call("adm_balance")), /"result":false/);
});

test("a body without result is an error, as in the official client", async () => {
  nextReply = { body: { response: { balance: "1" } } };
  const r = await call("adm_balance");
  assert.equal(r.isError, true, text(r));
});

test("domain/check keeps result:false as 'not available', not an error", async () => {
  const r = await call("adm_domain_check", { domain: "example.com" });
  assert.ok(!r.isError, text(r));
  assert.match(text(r), /Available: NO/);
  nextReply = { status: 500, body: "Synthetic server error" };
  assert.equal((await call("adm_domain_check", { domain: "example.com" })).isError, true);
});

// Finding 2: raw passthrough is opt-in and rejects path traversal.
test("adm_api_raw is not registered without ADM_ALLOW_RAW=true", async () => {
  const c = await connect({});
  try {
    const names = (await c.listTools()).tools.map((t) => t.name);
    assert.ok(!names.includes("adm_api_raw"));
    assert.equal(names.length, 12);
  } finally {
    await c.close();
  }
});

test("adm_api_raw rejects '..' and never sends the request", async () => {
  for (const action of ["../user/api", "dns/../billing/balance_get", "dns/list?x=1", ""]) {
    const r = await call("adm_api_raw", { action });
    assert.equal(r.isError, true, action);
    assert.equal(requests.length, 0, action);
  }
});

// Finding 4: mail/list may return a bare array or { list }.
test("adm_mail_domains reads { list } responses", async () => {
  const r = await call("adm_mail_domains");
  assert.ok(!r.isError, text(r));
  assert.match(text(r), /example\.com.*mail_id: 5/);
});

test("adm_mail_domains reads bare array responses", async () => {
  nextReply = { body: ok([{ id: 6, account_id: 1, domain: "example.org" }]) };
  assert.match(text(await call("adm_mail_domains")), /example\.org.*mail_id: 6/);
});

test("adm_mail_domains fails on an unrecognised response shape", async () => {
  nextReply = { body: ok({ unexpected: true }) };
  assert.equal((await call("adm_mail_domains")).isError, true);
});

// Finding 5: SRV is not a supported record type.
test("adm_dns_add rejects SRV", async () => {
  let r;
  try {
    r = await call("adm_dns_add", { domain_id: 1, type: "SRV", record: "_sip._tcp", data: "sip.example.com" });
  } catch (e) {
    r = { isError: true, content: [{ text: String(e) }] };
  }
  assert.equal(r.isError, true);
  assert.equal(requests.length, 0);
});

// Finding 6: nested raw params are encoded like PHP http_build_query.
test("adm_api_raw encodes nested params with PHP-style brackets", async () => {
  const params = JSON.stringify({ domain_id: 1, opts: { ttl: 300, flags: ["a", "b"] }, on: true, off: false, skip: null });
  const r = await call("adm_api_raw", { action: "dns/records_list", params });
  assert.ok(!r.isError, text(r));
  assert.deepEqual(last().form, { domain_id: "1", "opts[ttl]": "300", "opts[flags][0]": "a", "opts[flags][1]": "b", on: "1", off: "0" });
});

test("adm_api_raw rejects params that are not a JSON object", async () => {
  for (const params of ["5", "[1,2]", "not json"]) {
    const r = await call("adm_api_raw", { action: "dns/list", params });
    assert.equal(r.isError, true, params);
    assert.equal(requests.length, 0, params);
  }
});

// Standard: a write whose response is lost must not read as success or failure.
test("a dropped connection on a write reports outcome unknown with the read tool to check", async () => {
  nextReply = "destroy";
  const r = await call("adm_dns_add", { domain_id: 1, type: "A", record: "www", data: "192.0.2.1" });
  assert.equal(r.isError, true);
  assert.match(text(r), /outcome unknown.*adm_dns_records/i);
});
