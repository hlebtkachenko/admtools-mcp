const DEFAULT_BASE_URL = "https://adm.tools/action";
const TIMEOUT_MS = 30_000;
const ACTION_RE = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

export type ParamValue = string | number | boolean | null | undefined | ParamValue[] | { [key: string]: ParamValue };
export type Params = Record<string, ParamValue>;

export interface CallOptions {
  /** domain/check uses result:false for "not available", so it is not an error there. */
  allowFalseResult?: boolean;
  /** Read tool that shows whether a write landed; set for non-idempotent calls. */
  verifyWith?: string;
}

/** Form-encodes like PHP http_build_query, which the official client uses. */
export function encodeForm(params: Params): string {
  const out = new URLSearchParams();
  // fallow-ignore-next-line complexity -- one branch per http_build_query value kind (null, bool, nested, scalar)
  const add = (key: string, value: ParamValue) => {
    if (value === null || value === undefined) return;
    if (typeof value === "boolean") out.append(key, value ? "1" : "0");
    else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
    } else out.append(key, String(value));
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return out.toString();
}

function apiMessage(json: { error?: unknown; messages?: unknown }, text: string): string {
  if (json.error) return String(json.error);
  if (json.messages) return typeof json.messages === "string" ? json.messages : JSON.stringify(json.messages);
  return text.slice(0, 500);
}

export class AdmClient {
  private token: string;
  private baseUrl: string;

  constructor(token: string, baseUrl = DEFAULT_BASE_URL) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async call<T = Record<string, unknown>>(
    action: string,
    params?: Params,
    options: CallOptions = {},
  ): Promise<{ result: boolean; response: T }> {
    const sanitized = action.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!ACTION_RE.test(sanitized)) {
      throw new Error(`Invalid adm.tools action path: ${JSON.stringify(action)}`);
    }
    const url = `${this.baseUrl}/${sanitized}/`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params ? encodeForm(params) : "",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (options.verifyWith) {
        throw new Error(
          `adm.tools ${sanitized}: no response (${(err as Error).message}); outcome unknown, verify with ${options.verifyWith} before retrying`,
        );
      }
      throw err;
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`adm.tools ${sanitized} → ${res.status}: ${text.slice(0, 500)}`);
    }

    let json: { result?: unknown; response: T; error?: unknown; messages?: unknown };
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`API returned non-JSON response: ${text.slice(0, 200)}`);
    }
    if (!json || typeof json !== "object") {
      throw new Error(`adm.tools ${sanitized}: unexpected response: ${text.slice(0, 200)}`);
    }
    // The official client treats a missing or falsy result as failure.
    if (!json.result && !(options.allowFalseResult && json.result === false)) {
      throw new Error(`adm.tools ${sanitized} failed: ${apiMessage(json, text)}`);
    }

    return { result: Boolean(json.result), response: json.response };
  }
}
