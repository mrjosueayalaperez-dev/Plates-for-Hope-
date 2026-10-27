CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  headcount INTEGER NOT NULL,
  budget_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  verdict TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
