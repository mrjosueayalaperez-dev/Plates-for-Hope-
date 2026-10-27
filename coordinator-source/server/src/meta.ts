/**
 * meta.ts — PREPARED Meta Model API integration layer (NOT yet connected).
 *
 * Status (Oct 27, 2026): prepared, disabled, and honest about it.
 * - No credentials exist in this file or anywhere in the repo. The API key is
 *   read from the server environment at runtime and must never be committed,
 *   logged, or sent to browser code.
 * - Until the founder completes the credit claim and a key is configured,
 *   metaEnabled() returns false and the Coordinator runs entirely on its
 *   deterministic planning engine. The UI keeps showing "Meta AI not
 *   connected" — that label may only change after this layer is connected
 *   AND a generated result has been verified end to end (see
 *   META-INTEGRATION.md for the connection runbook and test matrix).
 *
 * Shape: the client speaks the OpenAI-compatible chat-completions
 * convention. The exact base URL and model name are deployment
 * configuration (META_MODEL_API_BASE_URL / META_MODEL_NAME), to be copied
 * from the founder's Meta Model API console at connection time — they are
 * deliberately not hard-coded guesses.
 */

export interface MetaConfig {
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
}

export function metaConfig(env: Record<string, string | undefined>): MetaConfig {
  const clean = (v: string | undefined) => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : null;
  };
  return {
    apiKey: clean(env.META_MODEL_API_KEY),
    baseUrl: clean(env.META_MODEL_API_BASE_URL),
    model: clean(env.META_MODEL_NAME),
  };
}

/** True only when key, base URL, and model are ALL configured. */
export function metaEnabled(cfg: MetaConfig): boolean {
  return cfg.apiKey !== null && cfg.baseUrl !== null && cfg.model !== null;
}

export interface MetaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MetaResult {
  ok: boolean;
  /** Model text when ok. Never label engine output with this type. */
  text: string | null;
  /** Machine-readable reason when not ok: "not_configured" | "http_<status>" | "network" | "bad_response" */
  error: string | null;
}

/**
 * One chat-completions call. Fails closed: any problem returns ok:false and
 * the caller must fall back to the deterministic engine's result, unchanged
 * and unlabeled as AI output.
 */
export async function metaChat(
  cfg: MetaConfig,
  messages: MetaMessage[],
  opts: { timeoutMs?: number } = {},
): Promise<MetaResult> {
  if (!metaEnabled(cfg)) return { ok: false, text: null, error: "not_configured" };
  const url = `${cfg.baseUrl!.replace(/\/+$/, "")}/chat/completions`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, messages }),
    });
    if (!res.ok) return { ok: false, text: null, error: `http_${res.status}` };
    const data: any = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      return { ok: false, text: null, error: "bad_response" };
    }
    return { ok: true, text, error: null };
  } catch {
    return { ok: false, text: null, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Intended wiring point (do NOT wire until connection day — see
 * META-INTEGRATION.md): inside the generateplan action, AFTER the engine
 * produces a verified plan, an enabled Meta layer may draft a short
 * organizer note / menu description from the plan's own facts. The engine's
 * numbers are never sent to the model for recomputation, model output never
 * alters quantities, prices, or verdicts, and any failure falls back to the
 * engine-only result with no AI labeling.
 */
