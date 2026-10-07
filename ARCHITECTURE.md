# Architecture

## Structure

```
src/
  index.ts          Entry point: env config, tool registration
  adm-client.ts     HTTP client: Bearer auth, form-encoded POST to /action/<path>/, result check
  tools/            One file per area (domains, dns, mail, billing); each registers its MCP tools
test/               node:test suite, runs dist/ against a fake adm.tools API
```

## Flow

```
MCP client --stdio--> tool handler --> AdmClient.call --POST /action/<path>/--> adm.tools
                           ^                                                     |
                           +------- { result, response } or thrown error <------+
```

## Design notes

- **Contract.** No machine-readable spec exists. Request shapes follow the official PHP client and are pinned in the test suite.
- **Errors.** `AdmClient.call` throws on HTTP errors, non-JSON bodies and a missing or false `result`, so failures reach the model as `isError`. `domain/check` opts out because `result` there means "available".
- **No retries.** Every call is a POST. A write that gets no response reports "outcome unknown" with the read tool to check.
- **Encoding.** Params are form-encoded like PHP `http_build_query` (`key[sub]=value`, booleans as 1/0).
- **Raw passthrough.** `adm_api_raw` uses the account-wide credential, so it is registered only with `ADM_ALLOW_RAW=true`; action paths are restricted to plain segments.
