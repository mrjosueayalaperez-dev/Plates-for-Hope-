# Plates for Hope AI Meal Coordinator

**Meta Global AI Developer Hackathon — project submission package**

A bilingual (English/Spanish) meal-planning coordinator for community meal organizers. Give it what you have, and it plans the meal around it.

## The problem

Small community meal efforts run on donated ingredients, a tight cash budget, and volunteers. The planning questions are always the same and always urgent: *With these ingredients, this much money, and this many people coming — what do we cook, what do we still need to buy, and what does each volunteer do, in what order?* Getting it wrong means running short, overspending, or serving something a guest cannot safely eat.

## What it does

The organizer enters:

- Available ingredients and quantities
- Grocery budget and currency (USD/EUR/GBP/MXN/CAD)
- Number of people to feed
- Dietary restrictions, **allergies** (a separate safety input), and available cooking equipment

The coordinator returns:

- A practical meal plan scaled to the headcount, with portions
- A grocery list split into **"You already have"** and **"To buy"**, with quantities and estimated costs
- A clear **UNDER / OVER budget verdict** with the difference, and the cheapest fix it can compute when over
- Preparation steps and a **volunteer checklist in serving order** (setup → prep → cook → hold safely → serve → pack leftovers → clean)

Organizers can edit inputs, **copy** the whole plan as text, and **save** plans to reopen later. The full experience is in English and Spanish at equal quality, mobile-first.

Safety behavior: a plan that touches a stated allergy is visibly flagged and carries an organizer-review notice — the tool **does not guarantee allergen safety**. Inputs are validated (headcount a whole number ≥ 1, quantities > 0, budget ≥ 0); invalid inputs are rejected with an explanation, never silently changed. When no honest plan exists, the app says so plainly and saves nothing.

## The truthful story

Plates for Hope has served **approximately 45 meals so far through the founder's direct community efforts**. Those meals were **not** coordinated through this app. Regular scheduled service is the goal this tool is built to support — it is not a current operation, and this project does not claim otherwise.

## How it works — and the Meta AI status, stated accurately

Today the app runs on a **transparent planning engine**: deterministic rules over a dish and ingredient-cost table, spending on-hand ingredients first, showing its arithmetic, and labeling every price an estimate.

**Meta AI is not connected yet.** The hackathon's required technology — generation with Meta's models through the **Meta Model API** — is prepared as a server-side layer (the API key never enters browser code) and swaps in when the founder completes two steps that only he can do:

1. Claim the $150 Meta Model API credits via the form in the Oct 26, 2026 Cerebral Valley acceptance email (each participant claims individually; deadline Nov 4, 9:00 PM ET).
2. Have a payment card on the Meta account, which Meta requires to use the credits (the Billing spend-limit is a notification, not a cap).

Until that integration is implemented and tested, the app and this package keep the label **"Meta AI not connected"** visible. Nothing in this project presents the planning engine, a mock, or a fallback as Meta AI.

## Demo

**Working app (live, public):** the Coordinator runs inside the Plates for Hope site — open https://mrjosueayalaperez-dev.github.io/Plates-for-Hope-/ and choose **Meal Coordinator** in the navigation (or jump to `#meal-coordinator`). It is a faithful on-device port of the same planning engine: enter fresh ingredients, budget, headcount, restrictions, and allergies, and it generates a new plan in the browser; plans save on the visitor's own device. Drive-tested live Oct 27, 2026 (Demo 1 exactly $45.65 UNDER by $14.35; a fresh potatoes scenario's arithmetic hand-verified). The original server-backed build also runs in the founder's account. A demonstration page presenting the live app's real generated results (reproduced, labeled) supports this package:

- Demo evidence page: https://muse.ai/s/plates-for-hope-ai-meal-coordinator-xaxd67qx0xkxwhxbxa/qMKVl3Ms8u_PMLg2ajZVNYJp6um9xfawI1JOn2v4O_Y

Verified live results (Oct 27, 2026) include Demo 1 "Tight budget" (chicken 8 lb + rice 10 lb on hand, $60, 40 people → menu + split grocery list with estimated additional purchases of **$45.65, UNDER budget by $14.35**) and a vegetarian + gluten-free run with nothing on hand (→ Lentil & Vegetable Soup, **$41.25 of a $90 budget**). Full figures: `TEST-EVIDENCE.md`.

## Setup / access for reviewers

- **Live app:** hosted, server-backed, bilingual; access is through the founder's account during the judging period (walkthrough and demo results in this repo and on the demo page).
- **This repository** holds the submission package: this README, `SUBMISSION.md` (the submission draft), and `TEST-EVIDENCE.md` (the test matrix and results).
- **Prices** shown by the app are planning estimates, not store prices.

## Limitations

- Grocery prices are estimates; actual store prices vary.
- Allergen safety is never guaranteed; flagged plans require organizer review.
- The Meta Model API generation layer is pending the founder's credit claim (above).
- Dish library is intentionally small and tuned to low-cost community cooking.

## Project facts

- **Builder:** Josue Ayala-Perez (solo entry)
- **Event:** Meta Global AI Developer Hackathon (Cerebral Valley), build window Oct 26 – Nov 4, 2026
- **Separate projects:** This hackathon build is independent of the Plates for Hope public web app, Family Bridge, and M&Q University.
