# Data Plan

## Context provenance
- `Inputs: ingredients on hand, total grocery budget, headcount, and dietary restrictions. Outputs: menu scaled to headcount, grocery list with quantities and estimated costs compared with budget, and volunteer preparation checklist in serving order.` (verbatim build request; defines the locked core spec)
- `SOLO — one participant, no teammates (founder, Oct 26)` (Day-1 spec locked Oct 26, 2026, read from workspace/goals/meta-hackathon-application-plates-for-hope-ai-meal-coordinator/files/hackathon-day1-spec-locked-2026-10-26.md)
- `Track: NOT named in the Oct 20 APPROVED email or the Oct 26 credits email — founder to confirm from his Cerebral Valley application. Do not infer it from solo participation.` (same locked spec; the artifact shows this honestly in a submission-prep panel instead of guessing a track)
- `v1 ships with the transparent planning engine above so the flow works end to end TODAY.` + `Until those steps complete, the app labels its engine honestly as the planning engine; it never claims Meta AI generation it is not performing.` (locked spec, Meta AI tooling layer section; generation is server-side via ctx.inference-ready actions but the v1 plan arithmetic is deterministic and shown)
- `~45 meals through direct community efforts; regular Tue/Thu service is a future goal, not current operation; no restaurant partnerships yet` (Oct 24 starter pack; used only as project-story context, never as a demo headcount or invented record)
- `Do not add a card, purchase credits, or enable paid overages. An alert is not a spending cap.` (verbatim build request; the credits panel lists the founder-only claim steps verbatim from the locked spec and takes no billing action)

## Tested sources
### Workspace Day-1 documents (starter pack, kickoff sheet, locked spec)
**Used by**: all actions (spec, demo cases, credits/track panel copy)
**Test command**: `muse.read` on the three files under `~/workspace/goals/meta-hackathon-application-plates-for-hope-ai-meal-coordinator/files/`
**Sample output**: Locked spec confirms inputs/outputs, three labeled DEMO cases (tight budget chicken+rice; 100-person mixed pantry; vegetarian + gluten-free), EN/ES parity requirement, deterministic engine rules (on-hand spent first, restrictions never violated silently, costs labeled estimates)
**Processing**: Spec implemented directly; demo cases ship as clearly labeled input presets the user taps to prefill the form — they create no saved records until the user generates a plan

### Artifact scaffold inspection
**Used by**: build (confirms no duplicate coordinator implementation exists in this slug)
**Test command**: `muse.read` on `~/workspace/ts-spaces/plates-for-hope-ai-meal-coordinator/` (space.json, server/src/schema.ts, server/src/actions.ts, client/src/App.tsx)
**Sample output**: Fresh scaffold only — placeholder `entries(id, text, created_at)` table and scaffold App; no prior coordinator code to continue, so this build creates the first implementation in this slug and does not touch the separate Plates for Hope public app / Meal Bridge
**Processing**: Replace scaffold schema/actions/UI entirely

## Web-search sources
None. No external facts, prices, or listings are fetched. Grocery costs are transparent planning estimates computed from stated per-unit assumptions shown inside each plan and labeled ESTIMATED — never presented as store prices, per the locked spec.

## Agent-task sources
None.

## Imagery
Imagery not needed: this is a working form-and-plan coordinator tool with no real dishes, places, or people to depict; a stock or generated food photo would imply real Plates for Hope meals that the record does not support. Visual identity comes from typography, color, and layout.

## Long-term data behavior
- **Refresh policy**: None — no cron, no external feed; plans render from the artifact DB when opened
- **Growth**: One row per plan the user explicitly generates and saves; demo presets never write rows on their own
- **Ordering**: Saved plans newest first
- **Time semantics**: created_at is a creation instant rendered viewer-local; plan contents carry no event dates


## Milestone 2 addendum (Oct 26, 2026 — founder assignment via Moose handoff)
- New inputs: budget CURRENCY (USD/EUR/GBP/MXN/CAD — estimates are planning figures written directly in the chosen currency; the engine never converts and never invents an exchange rate), ALLERGIES as a distinct safety input from dietary restrictions (selected allergens + free text; touching plans carry flags and a bilingual organizer-review note stating the tool does not guarantee allergen safety), and COOKING EQUIPMENT (full / limited one-burner / no-cook — each dish template declares a minimum equipment level and the engine only offers dishes the selection can make; a no-cook bean & corn salad main was added).
- Validation: headcount whole number ≥ 1, quantities > 0 when given, budget ≥ 0 — enforced in the form (bilingual messages) and again in the server request schema; invalid inputs are rejected with an explanation, never silently changed.
- Failure path: when constraints cannot be met (no equipment-compatible main, or budget $0 with missing items costing money), generatePlan returns status "cannot" with bilingual reasons plus could-do / could-not lists, and saves nothing.
- Grocery list renders in two explicit sections: "You already have" (on-hand applied) and "To buy".
- Copy results: the whole plan (menu, split grocery list, allergy flags, checklist) copies as plain text in the current language.
- AI status panel now states plainly: the transparent planning engine is what runs today; the Meta Model API generation layer is NOT connected (no key configured); founder setup steps listed verbatim, key stays server-side, never entered in the browser.
