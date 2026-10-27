// meta-note — Plates for Hope: Meta AI organizer-note endpoint.
// Mirrors coordinator-source/server/src/meta.ts (same fail-closed design).
//
// Secrets are set ONLY by the founder in the Supabase dashboard
// (project plates-for-hope → Edge Functions → Secrets):
//   META_MODEL_API_KEY, META_MODEL_API_BASE_URL, META_MODEL_NAME
// Until all three exist, this function answers { enabled: false } and calls
// nothing. The API key never appears in this repo, in the website's code, or
// in any response. The site's public anon key (already shipped in the page
// for its forms) gates access so the endpoint is not an open proxy.
//
// Behavior: receives meal-plan FACTS from the site (menu, headcount, totals
// already computed by the planning engine), asks the Meta Model API for a
// short organizer note using only those facts, and returns the note. It
// never computes or alters quantities, prices, or budget verdicts. Any
// failure returns { enabled: false } and the site shows the engine's plan
// alone, unlabeled as AI output.

const cors = {
  "Access-Control-Allow-Origin": "https://mrjosueayalaperez-dev.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ enabled: false, error: "method" }, 405);

  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  if (!anon || apikey !== anon) return json({ enabled: false, error: "unauthorized" }, 401);

  const key = Deno.env.get("META_MODEL_API_KEY") ?? "";
  const base = (Deno.env.get("META_MODEL_API_BASE_URL") ?? "").replace(/\/+$/, "");
  const model = Deno.env.get("META_MODEL_NAME") ?? "";
  if (!key || !base || !model) return json({ enabled: false });

  let b: any;
  try {
    b = await req.json();
  } catch {
    return json({ enabled: false, error: "bad_json" }, 400);
  }
  const lang = b?.lang === "es" ? "es" : "en";
  const headcount = Math.max(1, Math.min(1000, parseInt(b?.headcount, 10) || 0));
  const dishes = Array.isArray(b?.dishes)
    ? b.dishes.slice(0, 4).map((d: unknown) => String(d).slice(0, 80))
    : [];
  const title = String(b?.title ?? "").slice(0, 120);
  if (!headcount || dishes.length === 0) return json({ enabled: false, error: "bad_input" }, 400);

  const money = (c: unknown) =>
    typeof c === "number" && isFinite(c) ? (c / 100).toFixed(2) : "?";
  const facts =
    `Meal plan: ${title}. Serves ${headcount}. Dishes: ${dishes.join("; ")}. ` +
    `Estimated grocery total: ${String(b?.currency ?? "USD")} ${money(b?.totalCents)} ` +
    `against a budget of ${money(b?.budgetCents)}. Verdict: ${String(b?.verdict ?? "").slice(0, 16)}.`;
  const prompt =
    (lang === "es"
      ? "Escribe una nota breve para el organizador (2–3 oraciones, en español) sobre este plan de comida comunitaria. Menciona el menú y un consejo práctico de preparación o servicio. Usa SOLO los datos dados; no inventes precios, cantidades, organizaciones ni promesas. Datos: "
      : "Write a short organizer note (2–3 sentences, in English) about this community meal plan. Mention the menu and one practical prep or serving tip. Use ONLY the facts given; do not invent prices, quantities, organizations, or promises. Facts: ") +
    facts;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return json({ enabled: false, error: `upstream_${res.status}` });
    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return json({ enabled: false, error: "bad_response" });
    }
    return json({ enabled: true, note: text.trim().slice(0, 1200) });
  } catch {
    return json({ enabled: false, error: "network" });
  } finally {
    clearTimeout(timer);
  }
});
