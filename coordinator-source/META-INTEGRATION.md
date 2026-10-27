# Meta Model API — connection runbook (prepared Oct 27, 2026)

**Current status: NOT CONNECTED.** The Coordinator runs on its deterministic planning engine. Every surface keeps the label "Meta AI not connected" until step 6 below is complete. The prepared code lives in `server/src/meta.ts` (config from environment, fail-closed client, no credentials anywhere in this repo).

## Founder steps (only the founder can do these)
1. Claim the $150 Meta Model API credits via the form in the Oct 26, 2026 Cerebral Valley acceptance email (each participant claims individually; deadline Nov 4, 9:00 PM ET). Confirm on the Meta Billing page that the free credits were applied.
2. Have a payment card on the Meta account — Meta requires one to *use* the credits. The Billing "Spend Limit" is a notification threshold, not a spending cap; set it knowingly.
3. In the Meta Model API console, create an API key. **Do not send the key in chat, email, or any document.** It goes directly into the server environment (step 4) through the host's secret settings.
4. From the same console, note the API **base URL** and the **model name** to use (the hackathon tooling list names the Muse Spark series via the Meta Model API).

## Deployment configuration (server-side only)
Set these environment variables on the server host — never in browser code, never in the repo:
```
META_MODEL_API_KEY=<the key from step 3>
META_MODEL_API_BASE_URL=<base URL from step 4>
META_MODEL_NAME=<model name from step 4>
```
With any of the three unset, `metaEnabled()` is false and behavior is exactly today's engine-only behavior.

## Wiring (connection day, engineering)
- Wire `metaChat()` at the single seam documented at the bottom of `server/src/meta.ts`: after the engine produces a verified plan, the model may draft an organizer note / menu description from the plan's facts. The model never computes quantities, prices, or verdicts; its text is presented as a draft note, and any failure falls back to the engine-only result with no AI labeling.
- No other call sites. No key in logs. No key in client bundles (verify the built client contains no `META_` strings).

## Test matrix (all must pass before the label flips)
1. With env unset: full Milestone matrix re-run — identical engine results, label still "not connected."
2. With env set: Demo 1 + vegetarian/gluten-free + allergy cases — engine numbers unchanged; a Meta-drafted note appears and is labeled as model-generated.
3. Failure drills: wrong key (401), unreachable base URL, empty model response — each falls back to the engine-only result, no error shown to the organizer beyond the standing status line, nothing mislabeled.
4. Client bundle scan: no key material, no `META_MODEL_API_KEY` string in shipped browser code.
5. EN/ES: the status line and any model-note labeling render in both languages.

## Label rule
Only after 1–5 pass: the status line changes from "Meta AI not connected" to a precise statement of what the model does (e.g., "Menu notes drafted with Meta AI (Muse Spark via Meta Model API); all quantities and costs are computed by the planning engine"). Any broader claim requires its own test evidence.
