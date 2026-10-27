# Test evidence — Plates for Hope AI Meal Coordinator
Runs performed Oct 26–27, 2026, against the live app (its own actions and UI) — not against a copy.

## Milestone test matrix (Oct 26) — all passed
- **Limited ingredients** (rice only on hand): plan built; rice fully covered by on-hand stock.
- **Tight budget** ($5 for 100 people): OVER verdict returned with cheapest-fix guidance.
- **Vegetarian + gluten-free**: Lentil & Vegetable Soup chosen, satisfying both restrictions.
- **Allergy case** (egg allergy, eggs on hand): plan flagged for the dish and the on-hand stock; bilingual organizer-review banner shown; allergy-control step added to the checklist.
- **Currency + equipment** (EUR, vegan, no-cook): Bean & Corn Salad at €18.15 of a €40 budget — estimates written in EUR directly, never converted; an unrelated soy allergy correctly unflagged in dishes, organizer review still required.
- **Invalid inputs rejected**: headcount 0; quantity "0 lb"; quantity "-5 lb" — the negative-quantity hole was caught by audit, fixed in client, server, and parser, rebuilt, retested, and re-audited (pass). Client validation also verified for headcount 2.5 ("Nothing was changed for you").
- **Failure path**: $0 budget with nothing on hand → "cannot" result with bilingual reasons and could-do / could-not lists; **nothing was saved**.
- **UI drives**: demo prefill; plan generation through the form; "You already have" / "To buy" split rendering under partial and full coverage; Copy button beside the plan; failure panel rendering; full Spanish toggle with values preserved; saved plans listed with per-plan currencies and locale dates; Spanish status panel stating the planning engine runs today and the Meta Model API is not connected. A phone-width overflow found in the first audit was fixed and re-audited clean. Production started with zero saved plans (sandbox test plans discarded).

## Live verification runs (Oct 27) — via the app's own generate action
- **Demo 1 — Tight budget** (app preset): chicken thighs 8 lb + rice 10 lb on hand, $60 USD, 40 people, full kitchen → Herb Chicken & Rice with Mixed Vegetables + Seasoned Corn; on-hand applied (chicken 8 of 16 lb; rice fully covered); to buy $11.92 + $15.00 + $2.93 + $11.00 + $4.80 = **$45.65 — UNDER by $14.35 (~$1.14/person)**; 10-step checklist in serving order. Saved in the app as plan #1.
- **Vegetarian + gluten-free**: nothing on hand, $90 USD, 40 people → Lentil & Vegetable Soup + Seasoned Corn, both restrictions satisfied, no conflicts; **$41.25 — UNDER by $48.75 (~$1.03/person)**. Saved as plan #2.
- **Day-1 engine checks (Oct 26)**: arithmetic verified by direct calls (e.g., 16 lb chicken needed − 8 lb on hand = buy 8 lb × $1.49 = $11.92); live UI probe drove the real form and the Español toggle.

## Not verified / limits
- Real-device (physical phone) judging of the app is the founder's check; layout and flows are probe-verified at phone width.
- The Meta Model API layer is not connected (founder credit steps pending), so no Meta generation is tested — none is claimed.

## Integration verification (Oct 27) — working Coordinator inside the live Plates for Hope site
Per the founder's ruling, the working Coordinator was integrated into the Plates for Hope site itself (single-file merge; coordinator styles/scripts fenced under its own wrapper; the site's language function patched with a one-line guard so it cannot overwrite coordinator labels). The merged candidate was drive-tested at the real GitHub Pages host before promotion — **all 7 checks passed**:
1. Page loads; "Meal Coordinator" nav link scrolls to the section; form, presets, and status strip ("Meta AI is NOT connected") render.
2. Demo 1 inside the merged page: **exactly** $45.65, UNDER by $14.35, $1.14/person, all five buy lines, 10-step checklist.
3. Language guard: switching the *site* to Spanish left every coordinator label intact (no raw key names).
4. The coordinator's own Español rendered the full plan in Spanish.
5. Existing site intact: Request-a-Meal form complete; separate Meal Planner section present; no form submitted during testing.
6. Fresh scenario (potatoes 20 lb on hand, $35, 25 people): Lentil & Vegetable Soup, $20.09, UNDER by $14.91 — visible line items sum exactly to the total.
7. No visible page errors during the session. (Run was desktop-width; phone width was verified on the standalone working build — 0px overflow — whose scoped styles the merge carries unchanged.)
Promotion verified by cold fetch: https://mrjosueayalaperez-dev.github.io/Plates-for-Hope-/ serves the tested build byte-identically (760,311 bytes, SHA-256 4f901c29…e20). The founder's own phone test is the remaining device proof.

## Official portal verification (Oct 27, official sources only)
Sources: Cerebral Valley event page https://cerebralvalley.ai/e/meta-ai-developer-hackathon and its Official Rules https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver
- **Submission deadline CONFIRMED**: "Nov 4: Project submissions due by 9:00 PM ET." Judging Nov 4–8; winners Nov 9. (The previously reported figure was correct.)
- **Eligibility CONFIRMED**: 18+ and age of majority; application + acceptance only (cap 20,000); worldwide except prohibited/sanctioned jurisdictions; Meta/Cerebral Valley employees and households ineligible.
- **Tracks CONFIRMED**: Indie Developer (total $400,000) and Startup (total $550,000), plus up to $50,000 aggregate bonus prizes. A participant applies for **one track only**, and a submission may be entered in that one track only — the track is fixed at application. Which track this entry holds is **not publicly stated** (signed-in application detail).
- **Meta tooling CONFIRMED**: participants build with Meta AI products — Muse Spark series, Muse Wonder, Muse Image and SAM 3.1 through the Meta Model API; Meta open-weights models; Muse Code. Judging: Impact 30%, Use of Meta AI Tooling 25%, Technical Depth & Execution 20%, Demo 25%.
- **Submission portal CONFIRMED**: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit — the form's exact required fields are not published on the accessible official pages.
- **Credits CONFIRMED in substance**: selected participants receive $150 in Meta Model API credits, valid for a 10-day development window; detailed claim terms live in a separate Credit Terms document. The operative claim steps for this entry are in the founder's Oct 26, 2026 Cerebral Valley email (claim form; card on the Meta account required to use credits; claim deadline Nov 4, 9:00 PM ET).
