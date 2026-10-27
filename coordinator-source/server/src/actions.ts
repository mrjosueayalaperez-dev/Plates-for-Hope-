// Plates for Hope AI Meal Coordinator — server actions.
//
// The generation flow running TODAY is the transparent planning engine
// defined in the locked Day-1 spec (Oct 26, 2026): deterministic arithmetic,
// ingredients on hand spent first, dietary restrictions never violated
// silently, and every grocery cost labeled an ESTIMATE. The Meta Model API
// generation layer is NOT connected: no Meta API key is configured on the
// server. It swaps in server-side only once the founder completes the $150
// credits claim (form in the Oct 26 Cerebral Valley email; a card must be on
// the Meta account to use the credits; the API key stays server-side and is
// never entered in the browser). Until then the app labels this engine
// honestly and never claims Meta AI generation it is not performing.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Currencies. The planner's per-unit figures are planning estimates written
// directly in whichever currency the organizer picks — the engine NEVER
// converts between currencies and never invents an exchange rate.
// ---------------------------------------------------------------------------

const CURRENCY_CODES = ["USD", "EUR", "GBP", "MXN", "CAD"] as const;
type CurrencyCode = (typeof CURRENCY_CODES)[number];

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  MXN: "MX$",
  CAD: "CA$",
};

// ---------------------------------------------------------------------------
// Ingredient catalog. Costs are planning ESTIMATES in minor units (cents) of
// the chosen currency per unit — never store prices. Units: lb (weight),
// each, can, dozen, serving (flat pantry).
// ---------------------------------------------------------------------------

type Tags = {
  meat?: boolean;
  pork?: boolean;
  gluten?: boolean;
  dairy?: boolean;
  nuts?: boolean;
  egg?: boolean;
  soy?: boolean;
  animal?: boolean; // any animal product (for vegan checks)
};

type CatalogItem = {
  id: string;
  en: string;
  es: string;
  aliases: string[];
  unit: "lb" | "each" | "can" | "dozen" | "serving";
  unitEn: string;
  unitEs: string;
  costCents: number;
  tags: Tags;
};

const CATALOG: CatalogItem[] = [
  { id: "chicken", en: "Chicken thighs", es: "Muslos de pollo", aliases: ["chicken", "pollo", "chicken breast", "pechuga"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 149, tags: { meat: true, animal: true } },
  { id: "turkey", en: "Ground turkey", es: "Pavo molido", aliases: ["turkey", "pavo", "ground turkey"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 279, tags: { meat: true, animal: true } },
  { id: "beef", en: "Ground beef", es: "Carne molida de res", aliases: ["beef", "res", "ground beef", "carne molida"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 429, tags: { meat: true, animal: true } },
  { id: "pork", en: "Pork shoulder", es: "Paleta de cerdo", aliases: ["pork", "cerdo", "pork shoulder"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 139, tags: { meat: true, pork: true, animal: true } },
  { id: "tofu", en: "Tofu", es: "Tofu", aliases: ["tofu"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 190, tags: { soy: true } },
  { id: "eggs", en: "Eggs", es: "Huevos", aliases: ["egg", "eggs", "huevo", "huevos"], unit: "dozen", unitEn: "dozen", unitEs: "docena", costCents: 320, tags: { egg: true, animal: true } },
  { id: "lentils", en: "Dry lentils", es: "Lentejas secas", aliases: ["lentil", "lentils", "lentejas"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 110, tags: {} },
  { id: "dryBeans", en: "Dry beans", es: "Frijoles secos", aliases: ["dry beans", "beans", "frijoles secos", "frijoles"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 120, tags: {} },
  { id: "cannedBeans", en: "Canned beans", es: "Frijoles enlatados", aliases: ["canned beans", "frijoles enlatados"], unit: "can", unitEn: "cans", unitEs: "latas", costCents: 110, tags: {} },
  { id: "cannedTomatoes", en: "Canned tomatoes", es: "Tomates enlatados", aliases: ["canned tomatoes", "tomatoes", "tomates", "tomate"], unit: "can", unitEn: "cans", unitEs: "latas", costCents: 120, tags: {} },
  { id: "rice", en: "Long-grain rice", es: "Arroz de grano largo", aliases: ["rice", "arroz"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 85, tags: {} },
  { id: "pasta", en: "Pasta", es: "Pasta", aliases: ["pasta", "spaghetti", "macaroni", "fideos"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 115, tags: { gluten: true } },
  { id: "rolls", en: "Dinner rolls", es: "Panecillos", aliases: ["rolls", "roll", "bread", "pan", "panecillos"], unit: "each", unitEn: "rolls", unitEs: "panecillos", costCents: 45, tags: { gluten: true } },
  { id: "potatoes", en: "Potatoes", es: "Papas", aliases: ["potato", "potatoes", "papa", "papas"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 75, tags: {} },
  { id: "carrots", en: "Carrots", es: "Zanahorias", aliases: ["carrot", "carrots", "zanahoria", "zanahorias"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 95, tags: {} },
  { id: "onion", en: "Onions", es: "Cebollas", aliases: ["onion", "onions", "cebolla", "cebollas"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 90, tags: {} },
  { id: "mixedVeg", en: "Frozen mixed vegetables", es: "Verduras mixtas congeladas", aliases: ["mixed vegetables", "vegetables", "veggies", "verduras", "vegetales"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 125, tags: {} },
  { id: "corn", en: "Frozen corn", es: "Maíz congelado", aliases: ["corn", "maíz", "maiz", "elote"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 110, tags: {} },
  { id: "greens", en: "Salad greens", es: "Hojas para ensalada", aliases: ["salad", "greens", "lettuce", "lechuga", "ensalada"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 320, tags: {} },
  { id: "bananas", en: "Bananas", es: "Plátanos", aliases: ["banana", "bananas", "plátano", "plátanos", "platano"], unit: "each", unitEn: "bananas", unitEs: "plátanos", costCents: 65, tags: {} },
  { id: "cheese", en: "Shredded cheese", es: "Queso rallado", aliases: ["cheese", "queso"], unit: "lb", unitEn: "lb", unitEs: "lb", costCents: 350, tags: { dairy: true, animal: true } },
  { id: "pantry", en: "Pantry staples (oil, salt, spices)", es: "Básicos de despensa (aceite, sal, especias)", aliases: ["oil", "aceite", "spices", "especias", "salt", "sal"], unit: "serving", unitEn: "servings", unitEs: "porciones", costCents: 6, tags: {} },
];

const byId = (id: string): CatalogItem => {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) throw new Error(`catalog: unknown item ${id}`);
  return item;
};

function matchCatalog(name: string): CatalogItem | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  let best: CatalogItem | null = null;
  let bestLen = 0;
  for (const item of CATALOG) {
    const names = [item.en.toLowerCase(), item.es.toLowerCase(), ...item.aliases];
    for (const alias of names) {
      if ((n === alias || n.includes(alias) || alias.includes(n)) && alias.length > bestLen) {
        best = item;
        bestLen = alias.length;
      }
    }
  }
  return best;
}

// Parse a free-text on-hand quantity ("8 lb", "2 kg", "12", "1 dozen") into
// the catalog item's unit. Returns null when no usable number is present —
// the plan then shows the amount as uncounted instead of guessing.
function parseOnHandQty(text: string | undefined, item: CatalogItem): number | null {
  if (!text) return null;
  const m = text.replace(",", ".").match(/(-?\d+(?:\.\d+)?)/);
  if (!m || !m[1]) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const lower = text.toLowerCase();
  if (item.unit === "lb") {
    if (/\bkg\b|kilo/.test(lower)) return value * 2.20462;
    if (/\boz\b|onza/.test(lower)) return value / 16;
    if (/\bg\b|gram/.test(lower)) return value / 453.592;
    return value;
  }
  if (item.unit === "dozen") {
    if (/dozen|docena/.test(lower)) return value;
    if (value >= 6) return value / 12; // a bare count of eggs
    return value;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Cooking equipment. Each dish declares the minimum setup it honestly needs;
// the engine only offers dishes the selected equipment can actually make.
// ---------------------------------------------------------------------------

const EQUIPMENT_IDS = ["full", "limited", "none"] as const;
type EquipmentId = (typeof EQUIPMENT_IDS)[number];
type EquipLevel = 0 | 1 | 2; // 0 = no cooking, 1 = one burner, 2 = full kitchen

const EQUIP_LEVEL: Record<EquipmentId, EquipLevel> = { none: 0, limited: 1, full: 2 };

const EQUIP_LABELS: Record<EquipmentId, { en: string; es: string }> = {
  full: { en: "a full kitchen", es: "una cocina completa" },
  limited: { en: "limited equipment (one burner)", es: "equipo limitado (una hornilla)" },
  none: { en: "no cooking equipment", es: "sin equipo de cocina" },
};

// ---------------------------------------------------------------------------
// Dish templates. Quantities are per person; the plan shows the arithmetic.
// ---------------------------------------------------------------------------

type DishTemplate = {
  id: string;
  nameEn: string;
  nameEs: string;
  components: { itemId: string; perPerson: number }[];
  minEquip: EquipLevel;
  cookEn: string;
  cookEs: string;
};

const MAINS: DishTemplate[] = [
  {
    id: "chicken-rice",
    nameEn: "Herb Chicken & Rice with Mixed Vegetables",
    nameEs: "Pollo a las hierbas con arroz y verduras mixtas",
    components: [
      { itemId: "chicken", perPerson: 0.4 },
      { itemId: "rice", perPerson: 0.18 },
      { itemId: "mixedVeg", perPerson: 0.3 },
      { itemId: "onion", perPerson: 0.08 },
    ],
    minEquip: 2,
    cookEn: "Cook the chicken in batches until it reaches 165°F / 74°C inside; cook the rice separately and hold both hot.",
    cookEs: "Cocina el pollo en tandas hasta que alcance 165°F / 74°C por dentro; cocina el arroz por separado y mantén ambos calientes.",
  },
  {
    id: "turkey-chili",
    nameEn: "Turkey & Bean Chili",
    nameEs: "Chili de pavo y frijoles",
    components: [
      { itemId: "turkey", perPerson: 0.3 },
      { itemId: "dryBeans", perPerson: 0.12 },
      { itemId: "cannedTomatoes", perPerson: 0.25 },
      { itemId: "corn", perPerson: 0.15 },
      { itemId: "onion", perPerson: 0.1 },
    ],
    minEquip: 1,
    cookEn: "Brown the turkey, then simmer the chili at least 45 minutes. If dry beans are not pre-soaked, start them hours ahead or swap to canned beans.",
    cookEs: "Dora el pavo y luego cocina el chili a fuego lento al menos 45 minutos. Si los frijoles secos no están remojados, empieza horas antes o usa frijoles enlatados.",
  },
  {
    id: "lentil-soup",
    nameEn: "Lentil & Vegetable Soup",
    nameEs: "Sopa de lentejas y verduras",
    components: [
      { itemId: "lentils", perPerson: 0.16 },
      { itemId: "potatoes", perPerson: 0.3 },
      { itemId: "carrots", perPerson: 0.15 },
      { itemId: "onion", perPerson: 0.1 },
    ],
    minEquip: 1,
    cookEn: "Simmer lentils, potatoes, and carrots in plenty of water until tender, about 35–40 minutes. No soaking needed.",
    cookEs: "Hierve las lentejas, papas y zanahorias en abundante agua hasta que estén tiernas, unos 35–40 minutos. No necesitan remojo.",
  },
  {
    id: "pasta-bean",
    nameEn: "Pasta with White Bean & Vegetable Sauce",
    nameEs: "Pasta con salsa de frijoles blancos y verduras",
    components: [
      { itemId: "pasta", perPerson: 0.22 },
      { itemId: "cannedBeans", perPerson: 0.25 },
      { itemId: "cannedTomatoes", perPerson: 0.2 },
      { itemId: "mixedVeg", perPerson: 0.2 },
    ],
    minEquip: 2,
    cookEn: "Cook pasta in large pots of salted water; warm the bean and tomato sauce separately and combine at serving time so the pasta does not go soft.",
    cookEs: "Cocina la pasta en ollas grandes con agua con sal; calienta la salsa de frijoles y tomate por separado y combínala al servir para que la pasta no se ablande.",
  },
  {
    id: "egg-hash",
    nameEn: "Egg & Potato Hash",
    nameEs: "Picadillo de huevo y papa",
    components: [
      { itemId: "eggs", perPerson: 0.17 },
      { itemId: "potatoes", perPerson: 0.4 },
      { itemId: "mixedVeg", perPerson: 0.2 },
      { itemId: "onion", perPerson: 0.1 },
    ],
    minEquip: 1,
    cookEn: "Crisp the potatoes first, then add vegetables and pour in the beaten eggs near serving time so they stay soft.",
    cookEs: "Dora las papas primero, luego agrega las verduras y vierte los huevos batidos cerca de la hora de servir para que queden suaves.",
  },
  {
    id: "pork-sandwich",
    nameEn: "Pulled Pork Sandwiches with Carrot Slaw",
    nameEs: "Sándwiches de cerdo desmenuzado con ensalada de zanahoria",
    components: [
      { itemId: "pork", perPerson: 0.38 },
      { itemId: "rolls", perPerson: 1 },
      { itemId: "carrots", perPerson: 0.1 },
      { itemId: "greens", perPerson: 0.08 },
    ],
    minEquip: 2,
    cookEn: "Slow-cook the pork shoulder until it shreds easily (plan 3–4 hours, or use a pressure cooker); keep the slaw cold until serving.",
    cookEs: "Cocina la paleta de cerdo a fuego lento hasta que se desmenuce fácil (planea 3–4 horas, o usa olla a presión); mantén la ensalada fría hasta servir.",
  },
  {
    id: "tofu-stirfry",
    nameEn: "Tofu & Vegetable Stir-Fry with Rice",
    nameEs: "Salteado de tofu y verduras con arroz",
    components: [
      { itemId: "tofu", perPerson: 0.3 },
      { itemId: "rice", perPerson: 0.18 },
      { itemId: "mixedVeg", perPerson: 0.35 },
      { itemId: "onion", perPerson: 0.08 },
    ],
    minEquip: 2,
    cookEn: "Sear the tofu in batches, stir-fry the vegetables hot and fast, and cook the rice separately. Serve right away for the best texture.",
    cookEs: "Sella el tofu en tandas, saltea las verduras a fuego alto y rápido, y cocina el arroz por separado. Sirve enseguida para la mejor textura.",
  },
  {
    id: "beef-stew",
    nameEn: "Beef & Potato Stew",
    nameEs: "Guiso de res y papa",
    components: [
      { itemId: "beef", perPerson: 0.32 },
      { itemId: "potatoes", perPerson: 0.35 },
      { itemId: "carrots", perPerson: 0.18 },
      { itemId: "onion", perPerson: 0.1 },
    ],
    minEquip: 1,
    cookEn: "Brown the beef, then simmer with potatoes and carrots until everything is tender, about 60–75 minutes.",
    cookEs: "Dora la carne y luego cocina a fuego lento con papas y zanahorias hasta que todo esté tierno, unos 60–75 minutos.",
  },
  {
    id: "bean-corn-salad",
    nameEn: "Bean & Corn Salad with Greens",
    nameEs: "Ensalada de frijoles y maíz con hojas verdes",
    components: [
      { itemId: "cannedBeans", perPerson: 0.3 },
      { itemId: "corn", perPerson: 0.2 },
      { itemId: "greens", perPerson: 0.1 },
      { itemId: "onion", perPerson: 0.06 },
    ],
    minEquip: 0,
    cookEn: "No cooking: drain and rinse the canned beans, thaw the corn, fold everything together with the chopped onion, and chill until serving.",
    cookEs: "Sin cocción: escurre y enjuaga los frijoles enlatados, descongela el maíz, mezcla todo con la cebolla picada y enfría hasta servir.",
  },
];

const SIDES: DishTemplate[] = [
  {
    id: "side-salad",
    nameEn: "Garden Salad",
    nameEs: "Ensalada del huerto",
    components: [
      { itemId: "greens", perPerson: 0.12 },
      { itemId: "carrots", perPerson: 0.06 },
    ],
    minEquip: 0,
    cookEn: "Wash, dry, and chill the greens; assemble the salad at serving time.",
    cookEs: "Lava, seca y enfría las hojas; arma la ensalada al momento de servir.",
  },
  {
    id: "side-corn",
    nameEn: "Seasoned Corn",
    nameEs: "Maíz sazonado",
    components: [{ itemId: "corn", perPerson: 0.25 }],
    minEquip: 1,
    cookEn: "Steam the corn until bright and hot; season lightly.",
    cookEs: "Cocina el maíz al vapor hasta que esté caliente; sazona ligeramente.",
  },
  {
    id: "side-banana",
    nameEn: "Fresh Banana",
    nameEs: "Plátano fresco",
    components: [{ itemId: "bananas", perPerson: 1 }],
    minEquip: 0,
    cookEn: "Keep bananas whole and serve at room temperature.",
    cookEs: "Mantén los plátanos enteros y sirve a temperatura ambiente.",
  },
  {
    id: "side-rolls",
    nameEn: "Dinner Rolls",
    nameEs: "Panecillos",
    components: [{ itemId: "rolls", perPerson: 1 }],
    minEquip: 0,
    cookEn: "Warm the rolls briefly if you can; they are fine served at room temperature.",
    cookEs: "Calienta los panecillos brevemente si puedes; también se pueden servir a temperatura ambiente.",
  },
];

const LENTIL_SOUP = MAINS.find((m) => m.id === "lentil-soup") as DishTemplate;

// ---------------------------------------------------------------------------
// Restriction logic (dietary preferences/needs — distinct from allergies)
// ---------------------------------------------------------------------------

const RESTRICTION_IDS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "nut-free",
  "no-pork",
  "dairy-free",
  "diabetic-friendly",
] as const;
type RestrictionId = (typeof RESTRICTION_IDS)[number];

const RESTRICTION_LABELS: Record<RestrictionId, { en: string; es: string }> = {
  vegetarian: { en: "Vegetarian", es: "Vegetariano" },
  vegan: { en: "Vegan", es: "Vegano" },
  "gluten-free": { en: "Gluten-free", es: "Sin gluten" },
  "nut-free": { en: "Nut allergy", es: "Alergia a las nueces" },
  "no-pork": { en: "No pork", es: "Sin cerdo" },
  "dairy-free": { en: "Dairy-free", es: "Sin lácteos" },
  "diabetic-friendly": { en: "Diabetic-friendly", es: "Apto para diabéticos" },
};

function dishConflicts(dish: DishTemplate, restrictions: RestrictionId[]): RestrictionId[] {
  const tags: Tags = {};
  for (const c of dish.components) {
    const t = byId(c.itemId).tags;
    if (t.meat) tags.meat = true;
    if (t.pork) tags.pork = true;
    if (t.gluten) tags.gluten = true;
    if (t.dairy) tags.dairy = true;
    if (t.nuts) tags.nuts = true;
    if (t.egg) tags.egg = true;
    if (t.soy) tags.soy = true;
    if (t.animal) tags.animal = true;
  }
  const conflicts: RestrictionId[] = [];
  for (const r of restrictions) {
    if (r === "vegetarian" && tags.meat) conflicts.push(r);
    if (r === "vegan" && (tags.animal || tags.egg)) conflicts.push(r);
    if (r === "gluten-free" && tags.gluten) conflicts.push(r);
    if (r === "nut-free" && tags.nuts) conflicts.push(r);
    if (r === "no-pork" && tags.pork) conflicts.push(r);
    if (r === "dairy-free" && tags.dairy) conflicts.push(r);
    // diabetic-friendly: every menu is built without added sugar, so no
    // template conflicts; the plan states this plainly.
  }
  return conflicts;
}

function dishCostPerPersonCents(dish: DishTemplate): number {
  return dish.components.reduce(
    (sum, c) => sum + c.perPerson * byId(c.itemId).costCents,
    0,
  );
}

// ---------------------------------------------------------------------------
// Allergies — a distinct, safety-flagged input. The planner flags any plan
// that touches a stated allergy and requires organizer review; it never
// promises allergen safety.
// ---------------------------------------------------------------------------

const ALLERGEN_IDS = [
  "peanut",
  "tree-nut",
  "egg",
  "dairy",
  "gluten",
  "shellfish",
  "fish",
  "soy",
  "sesame",
] as const;
type AllergenId = (typeof ALLERGEN_IDS)[number];

const ALLERGEN_LABELS: Record<AllergenId, { en: string; es: string }> = {
  peanut: { en: "Peanuts", es: "Maní / cacahuate" },
  "tree-nut": { en: "Tree nuts", es: "Nueces de árbol" },
  egg: { en: "Egg", es: "Huevo" },
  dairy: { en: "Dairy / milk", es: "Lácteos / leche" },
  gluten: { en: "Gluten / wheat", es: "Gluten / trigo" },
  shellfish: { en: "Shellfish", es: "Mariscos" },
  fish: { en: "Fish", es: "Pescado" },
  soy: { en: "Soy", es: "Soya" },
  sesame: { en: "Sesame", es: "Sésamo / ajonjolí" },
};

function itemAllergenIds(item: CatalogItem): AllergenId[] {
  const ids = new Set<AllergenId>();
  if (item.tags.egg) ids.add("egg");
  if (item.tags.dairy) ids.add("dairy");
  if (item.tags.gluten) ids.add("gluten");
  if (item.tags.nuts) ids.add("tree-nut");
  if (item.tags.soy) ids.add("soy");
  const names = [item.en, item.es, ...item.aliases].join(" ").toLowerCase();
  if (/peanut|maní|mani|cacahuate/.test(names)) ids.add("peanut");
  if (/shrimp|shellfish|camar|marisco|crab|langosta/.test(names)) ids.add("shellfish");
  if (/fish|pescado|salm|tuna|atún|atun/.test(names)) ids.add("fish");
  if (/sesame|sésamo|sesamo|ajonjolí|ajonjoli/.test(names)) ids.add("sesame");
  return [...ids];
}

const ALLERGY_NOTE = {
  en: "ALLERGY REVIEW REQUIRED — An organizer must review every ingredient label and each preparation step before serving. This planner flags the ingredients it recognizes; it does NOT guarantee allergen safety, and controlling cross-contact in a shared kitchen is the organizer's responsibility.",
  es: "REVISIÓN DE ALERGIAS OBLIGATORIA — Un organizador debe revisar cada etiqueta de ingrediente y cada paso de preparación antes de servir. Este planificador marca los ingredientes que reconoce; NO garantiza seguridad frente a alérgenos, y controlar el contacto cruzado en una cocina compartida es responsabilidad del organizador.",
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtQty(qty: number): string {
  if (qty >= 100) return String(Math.round(qty));
  const rounded = Math.round(qty * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function roundBuyQty(qty: number, unit: CatalogItem["unit"]): number {
  if (qty <= 0) return 0;
  if (unit === "lb") return Math.ceil(qty * 4) / 4;
  return Math.ceil(qty);
}

// ---------------------------------------------------------------------------
// Planning engine
// ---------------------------------------------------------------------------

// A quantity, when given, must contain a number greater than 0. Invalid
// quantities are rejected here (and in the form) — never silently changed.
const qtyField = z
  .string()
  .max(40)
  .optional()
  .refine(
    (v) => {
      if (v === undefined || v.trim() === "") return true;
      // Signed match: "-5 lb" must be rejected, never read as +5.
      const m = v.replace(",", ".").match(/(-?\d+(?:\.\d+)?)/);
      if (!m || !m[1]) return false;
      return parseFloat(m[1]) > 0;
    },
    { message: "quantity must include a number greater than 0" },
  );

const onHandInput = z.object({
  name: z.string().min(1).max(80),
  qty: qtyField,
});

const generateInput = z.object({
  ingredientsOnHand: z.array(onHandInput).max(30),
  budgetDollars: z.number().min(0).max(100000),
  currency: z.enum(CURRENCY_CODES).default("USD"),
  headcount: z.number().int().min(1).max(5000),
  restrictions: z.array(z.enum(RESTRICTION_IDS)).max(7),
  otherRestrictions: z.string().max(300).optional(),
  allergies: z.array(z.enum(ALLERGEN_IDS)).max(9).default([]),
  otherAllergies: z.string().max(200).optional(),
  equipment: z.enum(EQUIPMENT_IDS).default("full"),
  accommodationServings: z.number().int().min(0).max(5000).optional(),
});

type GenerateInput = z.infer<typeof generateInput>;

type GroceryLine = {
  itemEn: string;
  itemEs: string;
  needed: number;
  unitEn: string;
  unitEs: string;
  onHandApplied: number;
  onHandNoteEn: string | null;
  onHandNoteEs: string | null;
  buyQty: number;
  unitCostCents: number;
  lineTotalCents: number;
  coveredByOnHand: boolean;
};

type PlanDish = {
  nameEn: string;
  nameEs: string;
  kind: "main" | "side" | "accommodation";
  servings: number;
  satisfiesEn: string[];
  satisfiesEs: string[];
  conflictsEn: string[];
  conflictsEs: string[];
  cookEn: string;
  cookEs: string;
};

type BiText = { en: string; es: string };

type Plan = {
  kind: "plan";
  titleEn: string;
  titleEs: string;
  headcount: number;
  currency: CurrencyCode;
  currencySymbol: string;
  equipment: EquipmentId;
  budgetCents: number;
  totalCents: number;
  diffCents: number;
  verdict: "under" | "over" | "exact";
  perPersonCents: number;
  dishes: PlanDish[];
  grocery: GroceryLine[];
  usedOnHand: BiText[];
  unmatchedOnHand: string[];
  uncountedOnHand: BiText[];
  checklist: { phaseEn: string; phaseEs: string; en: string; es: string }[];
  warnings: BiText[];
  allergyFlags: BiText[];
  allergyNote: BiText | null;
  cheapestFix: BiText | null;
};

// Returned instead of a plan when the constraints cannot honestly be met:
// the app says so plainly and shows what it could and could not do.
type CannotPlan = {
  kind: "cannot";
  titleEn: string;
  titleEs: string;
  currency: CurrencyCode;
  currencySymbol: string;
  reasons: BiText[];
  couldDo: BiText[];
  couldNot: BiText[];
};

// Compute grocery lines + total for a needs map against on-hand stock.
function computeGrocery(
  needs: Map<string, number>,
  onHandByItem: Map<string, number>,
): { grocery: GroceryLine[]; totalCents: number } {
  const grocery: GroceryLine[] = [];
  let totalCents = 0;
  for (const [itemId, neededQty] of [...needs.entries()].sort((a, b) => byId(a[0]).en.localeCompare(byId(b[0]).en))) {
    const item = byId(itemId);
    const onHandQty = onHandByItem.get(itemId) ?? 0;
    const applied = Math.min(onHandQty, neededQty);
    const remaining = Math.max(0, neededQty - applied);
    const buyQty = roundBuyQty(remaining, item.unit);
    const lineTotal = Math.round(buyQty * item.costCents);
    totalCents += lineTotal;
    grocery.push({
      itemEn: item.en,
      itemEs: item.es,
      needed: Math.round(neededQty * 100) / 100,
      unitEn: item.unitEn,
      unitEs: item.unitEs,
      onHandApplied: Math.round(applied * 100) / 100,
      onHandNoteEn: applied > 0 ? `${fmtQty(applied)} ${item.unitEn} from on hand` : null,
      onHandNoteEs: applied > 0 ? `${fmtQty(applied)} ${item.unitEs} de lo disponible` : null,
      buyQty,
      unitCostCents: item.costCents,
      lineTotalCents: lineTotal,
      coveredByOnHand: buyQty === 0,
    });
  }
  return { grocery, totalCents };
}

function buildPlan(input: GenerateInput): Plan | CannotPlan {
  const headcount = input.headcount;
  const currency = input.currency;
  const symbol = CURRENCY_SYMBOLS[currency];
  const money = (cents: number) => `${symbol}${(cents / 100).toFixed(2)}`;
  const budgetCents = Math.round(input.budgetDollars * 100);
  const restrictions = input.restrictions as RestrictionId[];
  const allergies = input.allergies as AllergenId[];
  const equipment = input.equipment as EquipmentId;
  const level = EQUIP_LEVEL[equipment];

  // Resolve on-hand ingredients against the catalog.
  const onHandByItem = new Map<string, number>(); // catalog id -> qty in unit
  const usedOnHand: BiText[] = [];
  const unmatchedOnHand: string[] = [];
  const uncountedOnHand: BiText[] = [];
  const matchedOnHandItems: CatalogItem[] = [];
  for (const raw of input.ingredientsOnHand) {
    const item = matchCatalog(raw.name);
    if (!item) {
      unmatchedOnHand.push(raw.name);
      continue;
    }
    matchedOnHandItems.push(item);
    const qty = parseOnHandQty(raw.qty, item);
    if (qty === null) {
      uncountedOnHand.push({ en: item.en, es: item.es });
    } else {
      onHandByItem.set(item.id, (onHandByItem.get(item.id) ?? 0) + qty);
    }
    usedOnHand.push({ en: item.en, es: item.es });
  }
  const onHandMatchCount = (dish: DishTemplate) =>
    dish.components.filter((c) => onHandByItem.has(c.itemId) || uncountedOnHand.some((u) => u.en === byId(c.itemId).en)).length;

  const templateOf = (dish: PlanDish): DishTemplate | undefined =>
    [...MAINS, ...SIDES].find((d) => dish.nameEn.startsWith(d.nameEn));

  // --- Failure path 1: no main dish the selected equipment can make. ------
  const equipPool = MAINS.filter((m) => m.minEquip <= level);
  if (equipPool.length === 0) {
    const satisfyingAny = MAINS.filter((m) => dishConflicts(m, restrictions).length === 0);
    return {
      kind: "cannot",
      titleEn: `No honest plan for ${headcount} servings`,
      titleEs: `No hay un plan honesto para ${headcount} porciones`,
      currency,
      currencySymbol: symbol,
      reasons: [
        {
          en: `No main dish in the planner can be made with ${EQUIP_LABELS[equipment].en}, so no plan was built rather than inventing one.`,
          es: `Ningún plato principal del planificador puede prepararse con ${EQUIP_LABELS[equipment].es}, así que no se creó ningún plan en lugar de inventar uno.`,
        },
      ],
      couldDo: satisfyingAny.map((d) => ({
        en: `With more equipment it could serve: ${d.nameEn}.`,
        es: `Con más equipo podría servir: ${d.nameEs}.`,
      })),
      couldNot: [
        {
          en: "It cannot invent a dish outside its tested menu, and it will not ignore a stated restriction or allergy to force a plan.",
          es: "No puede inventar un plato fuera de su menú probado, ni ignorar una restricción o alergia indicada para forzar un plan.",
        },
      ],
    };
  }

  // Choose the main dish: equipment-compatible first, then
  // restriction-satisfying, then most on-hand matches, then lowest cost.
  const satisfying = equipPool.filter((m) => dishConflicts(m, restrictions).length === 0);
  const pool = satisfying.length > 0 ? satisfying : equipPool;
  const main = [...pool].sort((a, b) => {
    const matchDiff = onHandMatchCount(b) - onHandMatchCount(a);
    if (matchDiff !== 0) return matchDiff;
    return dishCostPerPersonCents(a) - dishCostPerPersonCents(b);
  })[0] as DishTemplate;
  const mainConflicts = dishConflicts(main, restrictions);

  // Restriction-safe separate batch that the selected equipment can make.
  const pickFallback = (): DishTemplate | null => {
    const candidates = MAINS.filter(
      (m) => m.minEquip <= level && dishConflicts(m, restrictions).length === 0,
    ).sort((a, b) => dishCostPerPersonCents(a) - dishCostPerPersonCents(b));
    return candidates[0] ?? null;
  };
  const fallback = pickFallback();

  const warnings: BiText[] = [];
  const dishes: PlanDish[] = [];
  const needs = new Map<string, number>(); // catalog id -> total qty needed

  const addDishNeeds = (dish: DishTemplate, servings: number) => {
    for (const c of dish.components) {
      needs.set(c.itemId, (needs.get(c.itemId) ?? 0) + c.perPerson * servings);
    }
    needs.set("pantry", (needs.get("pantry") ?? 0) + servings);
  };

  const mainSatisfies = restrictions.filter((r) => !mainConflicts.includes(r));
  dishes.push({
    nameEn: main.nameEn,
    nameEs: main.nameEs,
    kind: "main",
    servings: headcount,
    satisfiesEn: mainSatisfies.map((r) => RESTRICTION_LABELS[r].en),
    satisfiesEs: mainSatisfies.map((r) => RESTRICTION_LABELS[r].es),
    conflictsEn: mainConflicts.map((r) => RESTRICTION_LABELS[r].en),
    conflictsEs: mainConflicts.map((r) => RESTRICTION_LABELS[r].es),
    cookEn: main.cookEn,
    cookEs: main.cookEs,
  });
  addDishNeeds(main, headcount);

  // Side dish: equipment-compatible and restriction-safe, cheapest first,
  // keeping a side only when the real (net of on-hand) total stays in budget.
  const sideCandidates = SIDES.filter(
    (s) => s.minEquip <= level && dishConflicts(s, restrictions).length === 0,
  ).sort((a, b) => dishCostPerPersonCents(a) - dishCostPerPersonCents(b));
  let side: DishTemplate | null = null;
  let cheapestSideExtra: { dish: DishTemplate; extraCents: number } | null = null;
  for (const candidate of sideCandidates) {
    const savedNeeds = new Map(needs);
    addDishNeeds(candidate, headcount);
    const trial = computeGrocery(needs, onHandByItem);
    const extra = trial.totalCents - computeGrocery(savedNeeds, onHandByItem).totalCents;
    if (cheapestSideExtra === null) cheapestSideExtra = { dish: candidate, extraCents: extra };
    if (trial.totalCents <= budgetCents) {
      side = candidate;
      break;
    }
    needs.clear();
    for (const [k, v] of savedNeeds) needs.set(k, v);
  }
  if (input.budgetDollars > 0 && !side && cheapestSideExtra) {
    warnings.push({
      en: `Budget does not leave room for a side dish. The cheapest side (${cheapestSideExtra.dish.nameEn}) would add about ${money(cheapestSideExtra.extraCents)} (estimate).`,
      es: `El presupuesto no deja margen para un acompañamiento. El más económico (${cheapestSideExtra.dish.nameEs}) agregaría unos ${money(cheapestSideExtra.extraCents)} (estimado).`,
    });
  }
  if (side) {
    dishes.push({
      nameEn: side.nameEn,
      nameEs: side.nameEs,
      kind: "side",
      servings: headcount,
      satisfiesEn: restrictions.map((r) => RESTRICTION_LABELS[r].en),
      satisfiesEs: restrictions.map((r) => RESTRICTION_LABELS[r].es),
      conflictsEn: [],
      conflictsEs: [],
      cookEn: side.cookEn,
      cookEs: side.cookEs,
    });
  }

  // Restricted-diet accommodation batch, called out separately.
  const accommodationServings = input.accommodationServings ?? 0;
  if (restrictions.length > 0 && mainConflicts.length > 0) {
    if (accommodationServings > 0 && fallback) {
      dishes.push({
        nameEn: `${fallback.nameEn} (separate restricted-diet batch)`,
        nameEs: `${fallback.nameEs} (porción separada para dietas restringidas)`,
        kind: "accommodation",
        servings: accommodationServings,
        satisfiesEn: restrictions.map((r) => RESTRICTION_LABELS[r].en),
        satisfiesEs: restrictions.map((r) => RESTRICTION_LABELS[r].es),
        conflictsEn: [],
        conflictsEs: [],
        cookEn: fallback.cookEn,
        cookEs: fallback.cookEs,
      });
      addDishNeeds(fallback, accommodationServings);
    } else if (accommodationServings > 0 && !fallback) {
      warnings.push({
        en: `No separate restricted-diet batch can be made with ${EQUIP_LABELS[equipment].en} that satisfies every listed restriction, so none was added. Do not serve the main dish to guests with those restrictions.`,
        es: `No se puede preparar una porción separada para dietas restringidas con ${EQUIP_LABELS[equipment].es} que cumpla todas las restricciones indicadas, así que no se agregó ninguna. No sirvas el plato principal a invitados con esas restricciones.`,
      });
    } else if (fallback) {
      warnings.push({
        en: `The main dish does not satisfy: ${mainConflicts.map((r) => RESTRICTION_LABELS[r].en).join(", ")}. Enter how many servings need a separate restricted-diet batch and the plan will add one (${fallback.nameEn} satisfies every listed restriction and can be made with the selected equipment). Until then, do not serve the main dish to guests with those restrictions.`,
        es: `El plato principal no cumple: ${mainConflicts.map((r) => RESTRICTION_LABELS[r].es).join(", ")}. Ingresa cuántas porciones necesitan una preparación separada y el plan agregará una (${fallback.nameEs} cumple todas las restricciones indicadas y puede prepararse con el equipo seleccionado). Mientras tanto, no sirvas el plato principal a invitados con esas restricciones.`,
      });
    } else {
      warnings.push({
        en: `The main dish does not satisfy: ${mainConflicts.map((r) => RESTRICTION_LABELS[r].en).join(", ")}, and no restriction-safe dish can be made with ${EQUIP_LABELS[equipment].en}. Do not serve the main dish to guests with those restrictions.`,
        es: `El plato principal no cumple: ${mainConflicts.map((r) => RESTRICTION_LABELS[r].es).join(", ")}, y ningún plato seguro puede prepararse con ${EQUIP_LABELS[equipment].es}. No sirvas el plato principal a invitados con esas restricciones.`,
      });
    }
  }

  // Free-text restrictions cannot be verified by the engine — flag them.
  const other = (input.otherRestrictions ?? "").trim();
  if (other) {
    warnings.push({
      en: `You also listed: "${other}". The planner checked the standard restrictions above only — review the menu against this need yourself before serving.`,
      es: `También indicaste: "${other}". El planificador verificó solo las restricciones estándar de arriba — revisa el menú frente a esta necesidad antes de servir.`,
    });
  }
  if (restrictions.includes("diabetic-friendly")) {
    warnings.push({
      en: "Diabetic-friendly: every menu in this planner is built without added sugar or sweetened drinks. Serve water, and let guests with diabetes judge portions of rice, pasta, and potatoes for themselves.",
      es: "Apto para diabéticos: todos los menús de este planificador se preparan sin azúcar añadida ni bebidas azucaradas. Sirve agua, y deja que los invitados con diabetes decidan sus porciones de arroz, pasta y papas.",
    });
  }
  for (const u of uncountedOnHand) {
    warnings.push({
      en: `${u.en} is on hand but no usable quantity was given, so the grocery list does not count it — you may need to buy less than listed. Add a quantity (for example "8 lb") to count it exactly.`,
      es: `${u.es} está disponible pero sin una cantidad utilizable, así que la lista de compras no lo descuenta — quizás necesites comprar menos de lo indicado. Agrega una cantidad (por ejemplo "8 lb") para contarlo con exactitud.`,
    });
  }

  // Grocery list: needs minus on-hand, rounded up to buyable quantities.
  const { grocery, totalCents } = computeGrocery(needs, onHandByItem);

  // --- Failure path 2: budget is 0 and the missing items cost money. ------
  if (budgetCents === 0 && totalCents > 0) {
    const covered = grocery.filter((g) => g.onHandApplied > 0);
    const missing = grocery.filter((g) => g.buyQty > 0);
    return {
      kind: "cannot",
      titleEn: `No honest plan for ${headcount} servings at ${money(0)}`,
      titleEs: `No hay un plan honesto para ${headcount} porciones con ${money(0)}`,
      currency,
      currencySymbol: symbol,
      reasons: [
        {
          en: `The budget is ${money(0)} and the missing ingredients for the closest menu (${main.nameEn}) cost about ${money(totalCents)} (estimate). A complete plan cannot be bought for ${money(0)}, so no plan was saved.`,
          es: `El presupuesto es ${money(0)} y los ingredientes faltantes para el menú más cercano (${main.nameEs}) cuestan unos ${money(totalCents)} (estimado). Un plan completo no puede comprarse por ${money(0)}, así que no se guardó ningún plan.`,
        },
      ],
      couldDo: [
        ...(covered.length > 0
          ? [
              {
                en: `Your on-hand ingredients already cover part of the menu: ${covered.map((g) => `${g.itemEn} (${fmtQty(g.onHandApplied)} ${g.unitEn})`).join(", ")}.`,
                es: `Tus ingredientes disponibles ya cubren parte del menú: ${covered.map((g) => `${g.itemEs} (${fmtQty(g.onHandApplied)} ${g.unitEs})`).join(", ")}.`,
              },
            ]
          : []),
        {
          en: `Set a budget of at least about ${money(totalCents)} (${currency}, estimate) and this same menu can be built for ${headcount} people.`,
          es: `Fija un presupuesto de al menos unos ${money(totalCents)} (${currency}, estimado) y este mismo menú puede prepararse para ${headcount} personas.`,
        },
      ],
      couldNot: [
        {
          en: `It cannot buy the missing items for ${money(0)}: ${missing.slice(0, 4).map((g) => g.itemEn).join(", ")}${missing.length > 4 ? ", …" : ""}.`,
          es: `No puede comprar los ingredientes faltantes por ${money(0)}: ${missing.slice(0, 4).map((g) => g.itemEs).join(", ")}${missing.length > 4 ? ", …" : ""}.`,
        },
        {
          en: "It will not shrink portions below one serving per person, drop a stated restriction, or list missing items as free to force the numbers to fit.",
          es: "No reducirá las porciones por debajo de una por persona, ni eliminará una restricción indicada, ni mostrará los ingredientes faltantes como gratuitos para forzar los números.",
        },
      ],
    };
  }

  const diffCents = budgetCents - totalCents;
  const verdict: Plan["verdict"] = diffCents > 0 ? "under" : diffCents < 0 ? "over" : "exact";

  // Cheapest fix when over budget: name the priciest buy line and point at
  // the cheapest protein the engine knows.
  let cheapestFix: Plan["cheapestFix"] = null;
  if (verdict === "over") {
    const priciest = [...grocery].filter((g) => g.buyQty > 0).sort((a, b) => b.lineTotalCents - a.lineTotalCents)[0];
    if (priciest) {
      cheapestFix = {
        en: `Over budget by ${money(-diffCents)}. The biggest line is ${priciest.itemEn} at ${money(priciest.lineTotalCents)} (estimate). The cheapest fix the planner can compute: build the main around lentils or beans (${LENTIL_SOUP.nameEn} costs about ${money(Math.round(dishCostPerPersonCents(LENTIL_SOUP)))} per person, estimate) or reduce servings of the priciest item — re-run with the lentil soup ingredients on hand to see the new total.`,
        es: `Sobre el presupuesto por ${money(-diffCents)}. La línea mayor es ${priciest.itemEs} con ${money(priciest.lineTotalCents)} (estimado). La corrección más económica que el planificador puede calcular: preparar el plato principal con lentejas o frijoles (${LENTIL_SOUP.nameEs} cuesta unos ${money(Math.round(dishCostPerPersonCents(LENTIL_SOUP)))} por persona, estimado) o reducir las porciones del ingrediente más caro — vuelve a ejecutar con los ingredientes de la sopa de lentejas disponibles para ver el nuevo total.`,
      };
    }
  }

  // --- Allergy flags: any dish or on-hand item touching a stated allergy. --
  const allergyFlags: BiText[] = [];
  const otherAllergies = (input.otherAllergies ?? "").trim();
  const allergyReviewRequired = allergies.length > 0 || otherAllergies !== "";
  if (allergyReviewRequired) {
    for (const a of allergies) {
      const label = ALLERGEN_LABELS[a];
      for (const dish of dishes) {
        const template = templateOf(dish);
        if (!template) continue;
        const hits = template.components
          .map((c) => byId(c.itemId))
          .filter((item) => itemAllergenIds(item).includes(a));
        if (hits.length > 0) {
          allergyFlags.push({
            en: `⚠ ${label.en} allergy: ${hits.map((h) => h.en).join(", ")} appear(s) in ${dish.nameEn}.`,
            es: `⚠ Alergia a ${label.es}: ${hits.map((h) => h.es).join(", ")} aparece(n) en ${dish.nameEs}.`,
          });
        }
      }
      const onHandHits = matchedOnHandItems.filter((item) => itemAllergenIds(item).includes(a));
      if (onHandHits.length > 0) {
        allergyFlags.push({
          en: `⚠ ${label.en} allergy: ${onHandHits.map((h) => h.en).join(", ")} is/are among your on-hand ingredients — keep apart and review before use.`,
          es: `⚠ Alergia a ${label.es}: ${onHandHits.map((h) => h.es).join(", ")} está(n) entre tus ingredientes disponibles — manténlos apartados y revísalos antes de usarlos.`,
        });
      }
    }
    if (otherAllergies) {
      const terms = otherAllergies
        .split(/[,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length >= 3);
      const allItems = new Map<string, CatalogItem>();
      for (const dish of dishes) {
        const template = templateOf(dish);
        if (template) for (const c of template.components) allItems.set(c.itemId, byId(c.itemId));
      }
      for (const item of matchedOnHandItems) allItems.set(item.id, item);
      for (const term of terms) {
        const hits = [...allItems.values()].filter((item) =>
          [item.en, item.es, ...item.aliases].some((n) => n.toLowerCase().includes(term)),
        );
        if (hits.length > 0) {
          allergyFlags.push({
            en: `⚠ Allergy "${term}": matched ${hits.map((h) => h.en).join(", ")} in the plan or on hand — review required.`,
            es: `⚠ Alergia "${term}": coincide con ${hits.map((h) => h.es).join(", ")} en el plan o en lo disponible — se requiere revisión.`,
          });
        }
      }
    }
    if (allergyFlags.length === 0) {
      allergyFlags.push({
        en: "No stated allergen was found in the planned dishes or the matched on-hand ingredients — ingredient labels and cross-contact still need the organizer review below.",
        es: "No se encontró ningún alérgeno indicado en los platos planificados ni en los ingredientes disponibles identificados — las etiquetas y el contacto cruzado aún necesitan la revisión del organizador indicada abajo.",
      });
    }
  }

  // Volunteer prep checklist, in serving order.
  const checklist: Plan["checklist"] = [];
  const step = (phaseEn: string, phaseEs: string, en: string, es: string) =>
    checklist.push({ phaseEn, phaseEs, en, es });

  step("Setup", "Preparación del espacio",
    `Set up the serving line for ${headcount} guests: tables, trays, serving spoons, gloves, and a hand-washing station.`,
    `Prepara la línea de servicio para ${headcount} invitados: mesas, bandejas, cucharas de servir, guantes y una estación para lavarse las manos.`);
  step("Setup", "Preparación del espacio",
    "Wash hands, tie back hair, and sanitize all food-contact surfaces before any food comes out.",
    "Lávense las manos, recójanse el cabello y desinfecten todas las superficies de contacto con alimentos antes de sacar cualquier comida.");
  if (allergyReviewRequired) {
    step("Setup", "Preparación del espacio",
      "Allergy control: the organizer reads every ingredient label against the stated allergies, keeps flagged ingredients and their utensils apart, and briefs every volunteer before cooking starts. This tool flags what it recognizes — it does not guarantee allergen safety.",
      "Control de alergias: el organizador lee cada etiqueta de ingrediente frente a las alergias indicadas, mantiene apartados los ingredientes marcados y sus utensilios, e instruye a cada voluntario antes de empezar a cocinar. Esta herramienta marca lo que reconoce — no garantiza seguridad frente a alérgenos.");
  }
  if (dishes.some((d) => d.kind === "accommodation")) {
    step("Setup", "Preparación del espacio",
      `Mark ${accommodationServings} servings as the separate restricted-diet batch and keep its pan, spoon, and tray apart from the main dish.`,
      `Marca ${accommodationServings} porciones como la preparación separada para dietas restringidas y mantén su olla, cuchara y bandeja apartadas del plato principal.`);
  }
  for (const dish of dishes) {
    const dishTemplate = templateOf(dish);
    if (dishTemplate) {
      const parts = dishTemplate.components.map((c) => {
        const item = byId(c.itemId);
        return `${fmtQty(Math.round(c.perPerson * dish.servings * 100) / 100)} ${item.unitEn} ${item.en.toLowerCase()}`;
      });
      const partsEs = dishTemplate.components.map((c) => {
        const item = byId(c.itemId);
        return `${fmtQty(Math.round(c.perPerson * dish.servings * 100) / 100)} ${item.unitEs} de ${item.es.toLowerCase()}`;
      });
      step("Prep", "Preparación",
        `Prep for ${dish.nameEn} (${dish.servings} servings): ${parts.join(", ")}. Wash produce, peel and chop, and measure everything before cooking starts.`,
        `Prepara para ${dish.nameEs} (${dish.servings} porciones): ${partsEs.join(", ")}. Lava los productos, pela y pica, y mide todo antes de empezar a cocinar.`);
    }
  }
  for (const dish of dishes) {
    step("Cook", "Cocción", `${dish.nameEn}: ${dish.cookEn}`, `${dish.nameEs}: ${dish.cookEs}`);
  }
  step("Hold safely", "Mantener seguro",
    "Hold all hot food at or above 140°F / 60°C. Keep cold items on ice or in the fridge until the moment of serving. Start a simple time log: when each pan came off the heat.",
    "Mantén toda la comida caliente a 140°F / 60°C o más. Mantén los alimentos fríos en hielo o en el refrigerador hasta el momento de servir. Lleva un registro simple de horarios: cuándo salió cada olla del fuego.");
  const serveOrder = [...dishes.filter((d) => d.kind === "side"), ...dishes.filter((d) => d.kind === "main"), ...dishes.filter((d) => d.kind === "accommodation")];
  const hasAccommodation = dishes.some((d) => d.kind === "accommodation");
  step("Serve", "Servir",
    `Serving order: ${serveOrder.map((d) => d.nameEn).join(" → ")}.${hasAccommodation ? " Serve the restricted-diet batch from its own pan and spoon, and announce it clearly so guests who need it can find it." : ""}`,
    `Orden de servicio: ${serveOrder.map((d) => d.nameEs).join(" → ")}.${hasAccommodation ? " Sirve la preparación para dietas restringidas desde su propia olla y cuchara, y anúnciala con claridad para que los invitados que la necesitan la encuentren." : ""}`);
  if (hasAccommodation) {
    step("Serve", "Servir",
      "One volunteer stays on the restricted-diet batch the whole service — never swap spoons between pans.",
      "Un voluntario se queda a cargo de la preparación para dietas restringidas durante todo el servicio — nunca intercambien cucharas entre ollas.");
  }
  step("Pack leftovers", "Guardar sobras",
    "After 2 hours at room temperature, food must not be served again. Pack safe leftovers into shallow containers, label with today's date, and refrigerate right away.",
    "Después de 2 horas a temperatura ambiente, la comida no debe servirse de nuevo. Guarda las sobras seguras en recipientes poco profundos, etiquétalos con la fecha de hoy y refrigera enseguida.");
  step("Clean", "Limpieza",
    "Wash, rinse, and sanitize all pans and utensils; wipe down the serving line; take out trash and leave the kitchen cleaner than you found it.",
    "Lava, enjuaga y desinfecta todas las ollas y utensilios; limpia la línea de servicio; saca la basura y deja la cocina más limpia de como la encontraste.");

  return {
    kind: "plan",
    titleEn: `${main.nameEn} — ${headcount} servings`,
    titleEs: `${main.nameEs} — ${headcount} porciones`,
    headcount,
    currency,
    currencySymbol: symbol,
    equipment,
    budgetCents,
    totalCents,
    diffCents,
    verdict,
    perPersonCents: headcount > 0 ? Math.round(totalCents / headcount) : 0,
    dishes,
    grocery,
    usedOnHand,
    unmatchedOnHand,
    uncountedOnHand,
    checklist,
    warnings,
    allergyFlags,
    allergyNote: allergyReviewRequired ? ALLERGY_NOTE : null,
    cheapestFix,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const planSummary = z.object({
  id: z.number(),
  title: z.string(),
  headcount: z.number(),
  budget_cents: z.number(),
  currency: z.string(),
  total_cents: z.number(),
  verdict: z.string(),
  created_at: z.string(),
});

const generateResponse = z.object({
  status: z.enum(["ok", "cannot"]),
  id: z.number().nullable(),
  planJson: z.string().nullable(),
  failureJson: z.string().nullable(),
  created_at: z.string().nullable(),
});

export const Actions = {
  generatePlan: defineAction({
    request: generateInput,
    response: generateResponse,
    async handler(ctx, args): Promise<z.infer<typeof generateResponse>> {
      const result = buildPlan(args);
      if (result.kind === "cannot") {
        // Honest failure: nothing is saved as if it were a plan.
        return {
          status: "cannot",
          id: null,
          planJson: null,
          failureJson: JSON.stringify(result),
          created_at: null,
        };
      }
      const db = ctx.db<typeof schema>();
      const insertedRows = await db
        .insert(schema.plans)
        .values({
          title: result.titleEn,
          headcount: result.headcount,
          budgetCents: result.budgetCents,
          currency: result.currency,
          totalCents: result.totalCents,
          verdict: result.verdict,
          inputsJson: JSON.stringify(args),
          planJson: JSON.stringify(result),
        })
        .returning({ id: schema.plans.id, createdAt: schema.plans.createdAt });
      const inserted = insertedRows[0];
      if (!inserted) throw new Error("generatePlan: insert returned no rows");
      ctx.invalidateQueries();
      return {
        status: "ok",
        id: inserted.id,
        planJson: JSON.stringify(result),
        failureJson: null,
        created_at: inserted.createdAt.toISOString(),
      };
    },
  }),

  listPlans: defineAction({
    request: z.object({ limit: z.number().int().positive().max(50).default(20) }),
    response: z.object({ plans: z.array(planSummary) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.plans)
        .orderBy(desc(schema.plans.id))
        .limit(args.limit);
      return {
        plans: rows.map((row) => ({
          id: row.id,
          title: row.title,
          headcount: row.headcount,
          budget_cents: row.budgetCents,
          currency: row.currency,
          total_cents: row.totalCents,
          verdict: row.verdict,
          created_at: row.createdAt.toISOString(),
        })),
      };
    },
  }),

  getPlan: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      id: z.number(),
      planJson: z.string(),
      inputsJson: z.string(),
      created_at: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.plans)
        .where(eq(schema.plans.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("getPlan: plan not found");
      return {
        id: row.id,
        planJson: row.planJson,
        inputsJson: row.inputsJson,
        created_at: row.createdAt.toISOString(),
      };
    },
  }),

  deletePlan: defineAction({
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.plans).where(eq(schema.plans.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
