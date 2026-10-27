import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Types (mirror the plan JSON the server engine returns)
// ---------------------------------------------------------------------------

type Lang = "en" | "es";
type BiText = { en: string; es: string };

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

type Plan = {
  kind: "plan";
  titleEn: string;
  titleEs: string;
  headcount: number;
  currency?: string;
  currencySymbol?: string;
  equipment?: string;
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
  allergyFlags?: BiText[];
  allergyNote?: BiText | null;
  cheapestFix: BiText | null;
};

type CannotPlan = {
  kind: "cannot";
  titleEn: string;
  titleEs: string;
  currency: string;
  currencySymbol: string;
  reasons: BiText[];
  couldDo: BiText[];
  couldNot: BiText[];
};

type OnHandRow = { name: string; qty: string };

const RESTRICTIONS = [
  { id: "vegetarian", en: "Vegetarian", es: "Vegetariano" },
  { id: "vegan", en: "Vegan", es: "Vegano" },
  { id: "gluten-free", en: "Gluten-free", es: "Sin gluten" },
  { id: "nut-free", en: "Nut allergy", es: "Alergia a las nueces" },
  { id: "no-pork", en: "No pork", es: "Sin cerdo" },
  { id: "dairy-free", en: "Dairy-free", es: "Sin lácteos" },
  { id: "diabetic-friendly", en: "Diabetic-friendly", es: "Apto para diabéticos" },
] as const;

type RestrictionId = (typeof RESTRICTIONS)[number]["id"];

const ALLERGENS = [
  { id: "peanut", en: "Peanuts", es: "Maní / cacahuate" },
  { id: "tree-nut", en: "Tree nuts", es: "Nueces de árbol" },
  { id: "egg", en: "Egg", es: "Huevo" },
  { id: "dairy", en: "Dairy / milk", es: "Lácteos / leche" },
  { id: "gluten", en: "Gluten / wheat", es: "Gluten / trigo" },
  { id: "shellfish", en: "Shellfish", es: "Mariscos" },
  { id: "fish", en: "Fish", es: "Pescado" },
  { id: "soy", en: "Soy", es: "Soya" },
  { id: "sesame", en: "Sesame", es: "Sésamo / ajonjolí" },
] as const;

type AllergenId = (typeof ALLERGENS)[number]["id"];

const EQUIPMENT = [
  { id: "full", en: "Full kitchen", es: "Cocina completa" },
  { id: "limited", en: "Limited — one burner / basic stove", es: "Limitado — una hornilla / estufa básica" },
  { id: "none", en: "No cooking — serve as-is", es: "Sin cocción — servir tal cual" },
] as const;

type EquipmentId = (typeof EQUIPMENT)[number]["id"];

const CURRENCIES = [
  { code: "USD", symbol: "$", en: "US dollar (USD)", es: "Dólar estadounidense (USD)" },
  { code: "EUR", symbol: "€", en: "Euro (EUR)", es: "Euro (EUR)" },
  { code: "GBP", symbol: "£", en: "British pound (GBP)", es: "Libra esterlina (GBP)" },
  { code: "MXN", symbol: "MX$", en: "Mexican peso (MXN)", es: "Peso mexicano (MXN)" },
  { code: "CAD", symbol: "CA$", en: "Canadian dollar (CAD)", es: "Dólar canadiense (CAD)" },
] as const;

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const symbolFor = (code: string | undefined): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";

const DEMOS: {
  key: string;
  labelEn: string;
  labelEs: string;
  onHand: OnHandRow[];
  budget: string;
  currency: CurrencyCode;
  headcount: string;
  restrictions: RestrictionId[];
  allergies: AllergenId[];
  equipment: EquipmentId;
  accommodation: string;
}[] = [
  {
    key: "tight",
    labelEn: "Demo 1 — Tight budget",
    labelEs: "Demo 1 — Presupuesto ajustado",
    onHand: [
      { name: "Chicken thighs", qty: "8 lb" },
      { name: "Rice", qty: "10 lb" },
    ],
    budget: "60",
    currency: "USD",
    headcount: "40",
    restrictions: [],
    allergies: [],
    equipment: "full",
    accommodation: "",
  },
  {
    key: "large",
    labelEn: "Demo 2 — Large headcount (100)",
    labelEs: "Demo 2 — Grupo grande (100)",
    onHand: [
      { name: "Rice", qty: "15 lb" },
      { name: "Dry beans", qty: "6 lb" },
      { name: "Potatoes", qty: "20 lb" },
      { name: "Onions", qty: "5 lb" },
    ],
    budget: "180",
    currency: "USD",
    headcount: "100",
    restrictions: [],
    allergies: [],
    equipment: "full",
    accommodation: "",
  },
  {
    key: "restricted",
    labelEn: "Demo 3 — Vegetarian + gluten-free",
    labelEs: "Demo 3 — Vegetariano + sin gluten",
    onHand: [
      { name: "Lentils", qty: "5 lb" },
      { name: "Carrots", qty: "4 lb" },
    ],
    budget: "90",
    currency: "USD",
    headcount: "50",
    restrictions: ["vegetarian", "gluten-free"],
    allergies: [],
    equipment: "full",
    accommodation: "",
  },
];

// ---------------------------------------------------------------------------
// UI strings
// ---------------------------------------------------------------------------

const S = {
  en: {
    planHeading: "Plan a meal service",
    planIntro:
      "Tell the coordinator what you have, what you can spend, and how many neighbors are coming. It builds the menu from what's on hand first, then the shopping list, then the serving plan — with every cost shown as an estimate.",
    engineNote:
      "Running today: the transparent planning engine (deterministic arithmetic on this server — same inputs, same plan). The Meta Model API generation layer is NOT connected yet; nothing on this page claims Meta AI generation it isn't doing. See the status panel at the bottom for the exact founder setup steps.",
    demoLabel: "Try a labeled demo case",
    onHand: "Ingredients on hand",
    onHandHint: "One per line. Add a quantity when you know it (e.g. “8 lb”) so the list counts it exactly.",
    ingredientName: "Ingredient name",
    ingredientQty: "Quantity (optional)",
    addIngredient: "Add ingredient",
    removeIngredient: "Remove ingredient",
    budget: "Total grocery budget",
    currency: "Currency for budget & estimates",
    currencyNote:
      "Estimates are planning figures written directly in the currency you pick — the planner never converts between currencies or invents an exchange rate.",
    headcount: "Headcount — people to serve",
    dietary: "Dietary restrictions / needs",
    otherNeeds: "Other needs (free text)",
    otherNeedsPh: "e.g. halal, low sodium…",
    allergiesTitle: "Allergies (safety — separate from dietary preferences)",
    allergiesHint:
      "Tap every allergy that applies. If a plan touches a stated allergy it is flagged, and an organizer must review it before serving — this tool does not guarantee allergen safety.",
    otherAllergies: "Other allergies (free text)",
    otherAllergiesPh: "e.g. mustard, celery…",
    equipmentTitle: "Cooking equipment available",
    accommodation: "Servings needing a separate restricted-diet batch (optional)",
    accommodationHint:
      "Only needed when the main dish can't satisfy a restriction. The plan adds a separate batch and keeps it apart in the checklist.",
    generate: "Build my meal plan",
    generating: "Building your plan…",
    errHeadcount: "Headcount must be a whole number of at least 1 — check the value and try again. Nothing was changed for you.",
    errBudget: "Budget must be a number of 0 or more (0 is fine when everything is on hand). Nothing was changed for you.",
    errQty: (name: string) =>
      `The quantity for “${name}” must be greater than 0 — fix it or clear the quantity. It was not changed for you.`,
    errAccommodation: "Separate-batch servings must be a whole number of 0 or more. Nothing was changed for you.",
    serviceError:
      "The planning service didn't respond. Your inputs are unchanged — check your connection and try again.",
    menuTitle: "Menu",
    mainDish: "Main dish",
    sideDish: "Side",
    accommodationDish: "Restricted-diet batch",
    servings: "servings",
    satisfies: "Satisfies",
    conflicts: "Does not satisfy",
    equipAssumed: "Equipment planned for",
    allergyBannerTitle: "Allergy review required",
    groceryTitle: "Grocery list — estimated costs",
    groceryNote:
      "Costs are planning estimates, not store prices. What you already have is listed separately from what you still need to buy.",
    haveTitle: "You already have",
    buyTitle: "To buy",
    needCol: "Needed",
    buyCol: "Buy",
    estCol: "Est.",
    onHandApplied: "from on hand",
    covered: "Covers everything needed — nothing to buy",
    coversPart: "covers part of what's needed",
    estTotal: "Estimated total",
    budgetLine: "Budget",
    underBy: "UNDER budget by",
    overBy: "OVER budget by",
    exactBudget: "Exactly on budget",
    perPerson: "per person",
    usedOnHand: "Used from on hand",
    unmatched: "Not in the planner's catalog — use as available",
    checklistTitle: "Volunteer prep checklist — in serving order",
    copyPlan: "Copy the whole plan",
    copied: "Copied ✓",
    failureTitle: "No honest plan for these inputs",
    couldDoTitle: "What the coordinator could do",
    couldNotTitle: "What it could not do",
    failureHint: "Nothing was saved. Change any input above and build again.",
    savedTitle: "Saved plans",
    noSaved: "No saved plans yet. Build one above and it will be kept here.",
    load: "Open",
    deletePlan: "Delete",
    prepTitle: "Status & hackathon submission prep",
    prepAiTitle: "Which AI integration is actually running",
    prepAiRunning:
      "Running today: the transparent planning engine in this app — deterministic arithmetic on the server. It is not a Meta AI model and does not generate text with an LLM.",
    prepAiNot:
      "NOT connected yet: the Meta Model API generation layer. No Meta API key is configured, so no Meta AI generation is happening anywhere in this app.",
    prepSolo: "Entry: SOLO — one participant, no teammates (confirmed by founder, Oct 26).",
    prepTrack:
      "Track: NOT named in the Oct 20 acceptance email or the Oct 26 credits email. Do not guess it — Josue confirms it from his Cerebral Valley application before submission.",
    prepCreditsTitle: "$150 Meta Model API credits — founder steps (no card is added here)",
    prepCredits1:
      "1. Submit the credits claim form linked in the Oct 26 Cerebral Valley email (each participant claims individually). Deadline: Nov 4, 9:00 PM ET. Credits arrive in batches — check the Meta Billing page to confirm the free credits are applied.",
    prepCredits2:
      "2. To use the credits, a credit card must be on the Meta account — founder's action only. This app adds no card, buys nothing, and enables no paid overages.",
    prepCredits3:
      "3. Set the “Spend Limit” notification on the Billing page — understand it clearly: it is an alert, NOT a spending cap.",
    prepCredits4:
      "4. When the Meta API key exists, the founder adds it through the secure server-side setup only — never in this page, never in the browser, never in chat. Plans will be labeled Meta-generated only for the parts the API actually produces.",
    prepDeadline: "Build window Oct 26 – Nov 4, 2026 · Submission due Nov 4, 9:00 PM ET.",
    factsNote:
      "Plates for Hope context: ~45 meals served so far through direct community efforts — those meals were not coordinated through this app. Regular Tue/Thu service is a future goal, not current operation; there are no restaurant partnerships yet. Those facts are the project story — never a demo headcount.",
    copyHeader: "PLATES FOR HOPE — MEAL PLAN",
    copyMenu: "MENU",
    copyHave: "GROCERY — YOU ALREADY HAVE",
    copyBuy: "GROCERY — TO BUY (estimates, not store prices)",
    copyAllergy: "ALLERGY FLAGS",
    copyChecklist: "VOLUNTEER CHECKLIST",
    copyFooter: "Costs are planning estimates, not store prices.",
  },
  es: {
    planHeading: "Planifica un servicio de comida",
    planIntro:
      "Dile al coordinador qué tienes, cuánto puedes gastar y cuántos vecinos vendrán. Construye el menú primero con lo que hay disponible, luego la lista de compras y luego el plan de servicio — con cada costo mostrado como estimado.",
    engineNote:
      "En funcionamiento hoy: el motor de planificación transparente (aritmética determinista en este servidor — los mismos datos, el mismo plan). La capa de generación con la API de Meta Model AÚN NO está conectada; nada en esta página afirma una generación por IA que no está haciendo. Consulta el panel de estado al final para los pasos exactos del fundador.",
    demoLabel: "Prueba un caso demo identificado",
    onHand: "Ingredientes disponibles",
    onHandHint: "Uno por línea. Agrega una cantidad cuando la sepas (p. ej. “8 lb”) para que la lista la cuente con exactitud.",
    ingredientName: "Nombre del ingrediente",
    ingredientQty: "Cantidad (opcional)",
    addIngredient: "Agregar ingrediente",
    removeIngredient: "Quitar ingrediente",
    budget: "Presupuesto total de compras",
    currency: "Moneda del presupuesto y los estimados",
    currencyNote:
      "Los estimados son cifras de planificación escritas directamente en la moneda que elijas — el planificador nunca convierte entre monedas ni inventa un tipo de cambio.",
    headcount: "Cantidad de personas a servir",
    dietary: "Restricciones / necesidades alimentarias",
    otherNeeds: "Otras necesidades (texto libre)",
    otherNeedsPh: "p. ej. halal, bajo en sodio…",
    allergiesTitle: "Alergias (seguridad — aparte de las preferencias alimentarias)",
    allergiesHint:
      "Marca cada alergia que aplique. Si un plan toca una alergia indicada, queda marcado y un organizador debe revisarlo antes de servir — esta herramienta no garantiza seguridad frente a alérgenos.",
    otherAllergies: "Otras alergias (texto libre)",
    otherAllergiesPh: "p. ej. mostaza, apio…",
    equipmentTitle: "Equipo de cocina disponible",
    accommodation: "Porciones que necesitan preparación separada (opcional)",
    accommodationHint:
      "Solo hace falta cuando el plato principal no puede cumplir una restricción. El plan agrega una preparación separada y la mantiene apartada en la lista de tareas.",
    generate: "Crear mi plan de comida",
    generating: "Creando tu plan…",
    errHeadcount: "La cantidad de personas debe ser un número entero de al menos 1 — revisa el valor e inténtalo de nuevo. Nada se cambió por ti.",
    errBudget: "El presupuesto debe ser un número de 0 o más (0 está bien si todo está disponible). Nada se cambió por ti.",
    errQty: (name: string) =>
      `La cantidad de “${name}” debe ser mayor que 0 — corrígela o borra la cantidad. No se cambió por ti.`,
    errAccommodation: "Las porciones de preparación separada deben ser un número entero de 0 o más. Nada se cambió por ti.",
    serviceError:
      "El servicio de planificación no respondió. Tus datos no cambiaron — revisa tu conexión e inténtalo de nuevo.",
    menuTitle: "Menú",
    mainDish: "Plato principal",
    sideDish: "Acompañamiento",
    accommodationDish: "Preparación para dietas restringidas",
    servings: "porciones",
    satisfies: "Cumple",
    conflicts: "No cumple",
    equipAssumed: "Equipo planificado",
    allergyBannerTitle: "Revisión de alergias obligatoria",
    groceryTitle: "Lista de compras — costos estimados",
    groceryNote:
      "Los costos son estimados de planificación, no precios de tienda. Lo que ya tienes se lista aparte de lo que aún debes comprar.",
    haveTitle: "Ya tienes",
    buyTitle: "Por comprar",
    needCol: "Se necesita",
    buyCol: "Comprar",
    estCol: "Est.",
    onHandApplied: "de lo disponible",
    covered: "Cubre todo lo necesario — nada que comprar",
    coversPart: "cubre parte de lo necesario",
    estTotal: "Total estimado",
    budgetLine: "Presupuesto",
    underBy: "POR DEBAJO del presupuesto por",
    overBy: "SOBRE el presupuesto por",
    exactBudget: "Exactamente en el presupuesto",
    perPerson: "por persona",
    usedOnHand: "Usado de lo disponible",
    unmatched: "No está en el catálogo del planificador — úsalo según disponibilidad",
    checklistTitle: "Lista de tareas para voluntarios — en orden de servicio",
    copyPlan: "Copiar el plan completo",
    copied: "Copiado ✓",
    failureTitle: "No hay un plan honesto para estos datos",
    couldDoTitle: "Lo que el coordinador sí pudo hacer",
    couldNotTitle: "Lo que no pudo hacer",
    failureHint: "No se guardó nada. Cambia cualquier dato arriba y crea el plan de nuevo.",
    savedTitle: "Planes guardados",
    noSaved: "Aún no hay planes guardados. Crea uno arriba y quedará guardado aquí.",
    load: "Abrir",
    deletePlan: "Borrar",
    prepTitle: "Estado y preparación de la entrega",
    prepAiTitle: "Qué integración de IA está funcionando realmente",
    prepAiRunning:
      "En funcionamiento hoy: el motor de planificación transparente de esta app — aritmética determinista en el servidor. No es un modelo de Meta AI y no genera texto con un LLM.",
    prepAiNot:
      "AÚN NO conectada: la capa de generación con la API de Meta Model. No hay ninguna clave de API de Meta configurada, así que no hay generación de Meta AI en ninguna parte de esta app.",
    prepSolo: "Participación: SOLO — un participante, sin compañeros de equipo (confirmado por el fundador, 26 de oct.).",
    prepTrack:
      "Categoría (track): NO aparece en el correo de aceptación del 20 de oct. ni en el de créditos del 26 de oct. No la adivines — Josue la confirma desde su solicitud en Cerebral Valley antes de la entrega.",
    prepCreditsTitle: "Créditos de $150 para la API de Meta Model — pasos del fundador (aquí no se agrega ninguna tarjeta)",
    prepCredits1:
      "1. Envía el formulario de reclamo de créditos enlazado en el correo de Cerebral Valley del 26 de oct. (cada participante reclama el suyo). Fecha límite: 4 de nov., 9:00 PM ET. Los créditos llegan en lotes — revisa la página de facturación de Meta para confirmar que se aplicaron.",
    prepCredits2:
      "2. Para usar los créditos, la cuenta de Meta debe tener una tarjeta — acción solo del fundador. Esta app no agrega tarjetas, no compra nada y no activa cargos adicionales.",
    prepCredits3:
      "3. Activa la notificación de “Límite de gasto” en la página de facturación — entiéndelo con claridad: es una alerta, NO un tope de gasto.",
    prepCredits4:
      "4. Cuando exista la clave de la API de Meta, el fundador la agrega solo mediante la configuración segura del servidor — nunca en esta página, nunca en el navegador, nunca por chat. Los planes se etiquetarán como generados por Meta solo en las partes que la API produzca realmente.",
    prepDeadline: "Ventana de construcción: 26 de oct. – 4 de nov. de 2026 · Entrega: 4 de nov., 9:00 PM ET.",
    factsNote:
      "Contexto de Plates for Hope: ~45 comidas servidas hasta ahora mediante esfuerzos directos de la comunidad — esas comidas no se coordinaron con esta app. El servicio regular de martes/jueves es una meta futura, no una operación actual; aún no hay alianzas con restaurantes. Esos datos son la historia del proyecto — nunca una cantidad de personas para el demo.",
    copyHeader: "PLATES FOR HOPE — PLAN DE COMIDA",
    copyMenu: "MENÚ",
    copyHave: "COMPRAS — YA TIENES",
    copyBuy: "COMPRAS — POR COMPRAR (estimados, no precios de tienda)",
    copyAllergy: "MARCAS DE ALERGIA",
    copyChecklist: "LISTA DE TAREAS PARA VOLUNTARIOS",
    copyFooter: "Los costos son estimados de planificación, no precios de tienda.",
  },
} as const;

const qtyFmt = (q: number) => {
  const r = Math.round(q * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = S[lang];
  const queryClient = useQueryClient();

  const [onHand, setOnHand] = useState<OnHandRow[]>([{ name: "", qty: "" }]);
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [headcount, setHeadcount] = useState("");
  const [restrictions, setRestrictions] = useState<RestrictionId[]>([]);
  const [otherNeeds, setOtherNeeds] = useState("");
  const [allergies, setAllergies] = useState<AllergenId[]>([]);
  const [otherAllergies, setOtherAllergies] = useState("");
  const [equipment, setEquipment] = useState<EquipmentId>("full");
  const [accommodation, setAccommodation] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [failure, setFailure] = useState<CannotPlan | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [showPrep, setShowPrep] = useState(false);

  const sym = symbolFor(currency);
  const money = (cents: number) => `${sym}${(cents / 100).toFixed(2)}`;
  const planSym = plan ? (plan.currencySymbol ?? symbolFor(plan.currency)) : sym;
  const planMoney = (cents: number) => `${planSym}${(cents / 100).toFixed(2)}`;

  const saved = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.listPlans({ limit: 20 }),
  });

  const generate = useMutation({
    mutationFn: api.generatePlan,
    onSuccess: (data) => {
      setChecked(new Set());
      setCopied(false);
      if (data.status === "ok" && data.planJson) {
        setPlan(JSON.parse(data.planJson) as Plan);
        setFailure(null);
        queryClient.invalidateQueries({ queryKey: ["plans"] });
      } else if (data.failureJson) {
        setFailure(JSON.parse(data.failureJson) as CannotPlan);
        setPlan(null);
      }
    },
  });

  const openSaved = useMutation({
    mutationFn: (id: number) => api.getPlan({ id }),
    onSuccess: (data) => {
      setPlan(JSON.parse(data.planJson) as Plan);
      setFailure(null);
      setChecked(new Set());
      setCopied(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deletePlan({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  const applyDemo = (demo: (typeof DEMOS)[number]) => {
    setOnHand(demo.onHand.map((r) => ({ ...r })));
    setBudget(demo.budget);
    setCurrency(demo.currency);
    setHeadcount(demo.headcount);
    setRestrictions([...demo.restrictions]);
    setOtherNeeds("");
    setAllergies([...demo.allergies]);
    setOtherAllergies("");
    setEquipment(demo.equipment);
    setAccommodation(demo.accommodation);
    setFormErrors([]);
    setFailure(null);
  };

  const submit = () => {
    // Validation: invalid inputs are rejected with an explanation and are
    // never silently changed.
    const errors: string[] = [];
    const headTrim = headcount.trim();
    const headNum = Number(headTrim);
    if (headTrim === "" || !Number.isInteger(headNum) || headNum < 1) {
      errors.push(t.errHeadcount);
    }
    const budgetTrim = budget.trim();
    const budgetNum = Number(budgetTrim);
    if (budgetTrim === "" || Number.isNaN(budgetNum) || budgetNum < 0) {
      errors.push(t.errBudget);
    }
    for (const row of onHand) {
      const q = row.qty.trim();
      if (row.name.trim() !== "" && q !== "") {
        // Signed match: "-5 lb" must be rejected, never read as +5.
        const m = q.replace(",", ".").match(/(-?\d+(?:\.\d+)?)/);
        if (!m || !m[1] || parseFloat(m[1]) <= 0) {
          errors.push(t.errQty(row.name.trim()));
        }
      }
    }
    const accTrim = accommodation.trim();
    const accNum = Number(accTrim);
    if (accTrim !== "" && (!Number.isInteger(accNum) || accNum < 0)) {
      errors.push(t.errAccommodation);
    }
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
    generate.mutate({
      ingredientsOnHand: onHand
        .filter((r) => r.name.trim() !== "")
        .map((r) => ({ name: r.name.trim(), qty: r.qty.trim() || undefined })),
      budgetDollars: budgetNum,
      currency,
      headcount: headNum,
      restrictions: [...restrictions],
      otherRestrictions: otherNeeds.trim() || undefined,
      allergies: [...allergies],
      otherAllergies: otherAllergies.trim() || undefined,
      equipment,
      accommodationServings: accTrim === "" ? undefined : accNum,
    });
  };

  const toggleRestriction = (id: RestrictionId) =>
    setRestrictions((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const toggleAllergy = (id: AllergenId) =>
    setAllergies((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const dishKindLabel = (kind: PlanDish["kind"]) =>
    kind === "main" ? t.mainDish : kind === "side" ? t.sideDish : t.accommodationDish;

  const buildPlanText = (p: Plan): string => {
    const lines: string[] = [];
    const m = (cents: number) => `${p.currencySymbol ?? symbolFor(p.currency)}${(cents / 100).toFixed(2)}`;
    lines.push(t.copyHeader);
    lines.push(lang === "en" ? p.titleEn : p.titleEs);
    lines.push(
      `${t.headcount}: ${p.headcount} · ${t.budgetLine}: ${m(p.budgetCents)} ${p.currency ?? ""} · ${t.estTotal}: ${m(p.totalCents)}`,
    );
    lines.push(
      p.verdict === "under"
        ? `${t.underBy} ${m(p.diffCents)}`
        : p.verdict === "over"
          ? `${t.overBy} ${m(-p.diffCents)}`
          : t.exactBudget,
    );
    lines.push("");
    lines.push(t.copyMenu);
    for (const d of p.dishes) {
      lines.push(
        `- ${dishKindLabel(d.kind)}: ${lang === "en" ? d.nameEn : d.nameEs} (${d.servings} ${t.servings}) — ${lang === "en" ? d.cookEn : d.cookEs}`,
      );
    }
    const have = p.grocery.filter((g) => g.onHandApplied > 0);
    const buy = p.grocery.filter((g) => g.buyQty > 0);
    if (have.length > 0) {
      lines.push("");
      lines.push(t.copyHave);
      for (const g of have) {
        lines.push(
          `- ${lang === "en" ? g.itemEn : g.itemEs}: ${qtyFmt(g.onHandApplied)} ${lang === "en" ? g.unitEn : g.unitEs}`,
        );
      }
    }
    lines.push("");
    lines.push(t.copyBuy);
    if (buy.length === 0) lines.push("- —");
    for (const g of buy) {
      lines.push(
        `- ${lang === "en" ? g.itemEn : g.itemEs}: ${qtyFmt(g.buyQty)} ${lang === "en" ? g.unitEn : g.unitEs} — ${m(g.lineTotalCents)}`,
      );
    }
    if (p.allergyNote) {
      lines.push("");
      lines.push(t.copyAllergy);
      for (const f of p.allergyFlags ?? []) lines.push(`- ${lang === "en" ? f.en : f.es}`);
      lines.push(lang === "en" ? p.allergyNote.en : p.allergyNote.es);
    }
    if (p.warnings.length > 0) {
      lines.push("");
      for (const w of p.warnings) lines.push(`! ${lang === "en" ? w.en : w.es}`);
    }
    lines.push("");
    lines.push(t.copyChecklist);
    p.checklist.forEach((s, i) => {
      lines.push(`${i + 1}. [${lang === "en" ? s.phaseEn : s.phaseEs}] ${lang === "en" ? s.en : s.es}`);
    });
    lines.push("");
    lines.push(t.copyFooter);
    return lines.join("\n");
  };

  const copyPlan = async () => {
    if (!plan) return;
    const text = buildPlanText(plan);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const haveLines = plan ? plan.grocery.filter((g) => g.onHandApplied > 0) : [];
  const buyLines = plan ? plan.grocery.filter((g) => g.buyQty > 0) : [];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main className="mx-auto w-full max-w-3xl px-4 pb-10">
        {/* Language toggle */}
        <div className="flex items-center justify-end gap-2 pt-4" role="group" aria-label="Language / Idioma">
          {(["en", "es"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${
                lang === l
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              }`}
            >
              {l === "en" ? "English" : "Español"}
            </button>
          ))}
        </div>

        <h1 className="mt-2 font-serif text-3xl leading-tight">{t.planHeading}</h1>
        <p className="mt-2 text-base text-[var(--dim)]">{t.planIntro}</p>
        <p className="mt-2 text-sm text-[var(--dim)]">{t.factsNote}</p>

        {/* Demo presets */}
        <section aria-label={t.demoLabel} className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--dim)]">{t.demoLabel}</h2>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {DEMOS.map((demo) => (
              <button
                key={demo.key}
                type="button"
                onClick={() => applyDemo(demo)}
                className="min-h-[44px] rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 text-left text-sm font-semibold text-[var(--accent)]"
              >
                {lang === "en" ? demo.labelEn : demo.labelEs}
              </button>
            ))}
          </div>
        </section>

        {/* Builder form */}
        <form
          className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset className="min-w-0">
            <legend className="text-base font-semibold">{t.onHand}</legend>
            <p className="mt-1 text-sm text-[var(--dim)]">{t.onHandHint}</p>
            <div className="mt-3 flex flex-col gap-2">
              {onHand.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    aria-label={`${t.ingredientName} ${i + 1}`}
                    value={row.name}
                    onChange={(e) =>
                      setOnHand((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder={lang === "en" ? "e.g. Rice" : "p. ej. Arroz"}
                    className="min-h-[44px] min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
                  />
                  <input
                    aria-label={`${t.ingredientQty} ${i + 1}`}
                    value={row.qty}
                    onChange={(e) =>
                      setOnHand((prev) => prev.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                    }
                    placeholder="8 lb"
                    className="min-h-[44px] w-24 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
                  />
                  <button
                    type="button"
                    aria-label={`${t.removeIngredient} ${i + 1}`}
                    onClick={() => setOnHand((prev) => prev.filter((_, j) => j !== i))}
                    className="min-h-[44px] w-11 shrink-0 rounded-[var(--radius)] border border-[var(--border)] text-lg text-[var(--dim)]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOnHand((prev) => [...prev, { name: "", qty: "" }])}
              className="mt-2 min-h-[44px] rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
            >
              + {t.addIngredient}
            </button>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="budget" className="text-base font-semibold">
                {t.budget}
              </label>
              <input
                id="budget"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="85"
                className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="currency" className="text-base font-semibold">
                {t.currency}
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {lang === "en" ? c.en : c.es}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="headcount" className="text-base font-semibold">
                {t.headcount}
              </label>
              <input
                id="headcount"
                inputMode="numeric"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="60"
                className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
              />
            </div>
          </div>
          <p className="mt-1 text-sm text-[var(--dim)]">{t.currencyNote}</p>

          <fieldset className="mt-5 min-w-0">
            <legend className="text-base font-semibold">{t.dietary}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESTRICTIONS.map((r) => {
                const active = restrictions.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleRestriction(r.id)}
                    className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${
                      active
                        ? "bg-[var(--green)] text-white"
                        : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                    }`}
                  >
                    {lang === "en" ? r.en : r.es}
                  </button>
                );
              })}
            </div>
            <label htmlFor="other-needs" className="mt-4 block text-sm font-semibold">
              {t.otherNeeds}
            </label>
            <input
              id="other-needs"
              value={otherNeeds}
              onChange={(e) => setOtherNeeds(e.target.value)}
              placeholder={t.otherNeedsPh}
              className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
            />
          </fieldset>

          <fieldset className="mt-5 min-w-0">
            <legend className="text-base font-semibold">{t.allergiesTitle}</legend>
            <p className="mt-1 text-sm text-[var(--dim)]">{t.allergiesHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const active = allergies.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAllergy(a.id)}
                    className={`min-h-[44px] rounded-full px-4 text-sm font-semibold ${
                      active
                        ? "bg-[var(--amber)] text-white"
                        : "border border-[var(--amber)] bg-[var(--bg)] text-[var(--text)]"
                    }`}
                  >
                    {lang === "en" ? a.en : a.es}
                  </button>
                );
              })}
            </div>
            <label htmlFor="other-allergies" className="mt-4 block text-sm font-semibold">
              {t.otherAllergies}
            </label>
            <input
              id="other-allergies"
              value={otherAllergies}
              onChange={(e) => setOtherAllergies(e.target.value)}
              placeholder={t.otherAllergiesPh}
              className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
            />
          </fieldset>

          <fieldset className="mt-5 min-w-0">
            <legend className="text-base font-semibold">{t.equipmentTitle}</legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {EQUIPMENT.map((eq) => {
                const active = equipment === eq.id;
                return (
                  <button
                    key={eq.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setEquipment(eq.id)}
                    className={`min-h-[44px] flex-1 rounded-[var(--radius)] px-3 text-sm font-semibold ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                    }`}
                  >
                    {lang === "en" ? eq.en : eq.es}
                  </button>
                );
              })}
            </div>
            <label htmlFor="accommodation" className="mt-4 block text-sm font-semibold">
              {t.accommodation}
            </label>
            <input
              id="accommodation"
              inputMode="numeric"
              value={accommodation}
              onChange={(e) => setAccommodation(e.target.value)}
              placeholder="0"
              className="mt-1 min-h-[44px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base sm:w-40"
            />
            <p className="mt-1 text-sm text-[var(--dim)]">{t.accommodationHint}</p>
          </fieldset>

          {formErrors.length > 0 && (
            <div
              role="alert"
              className="mt-4 flex flex-col gap-1 rounded-[var(--radius)] bg-[var(--amber-soft)] px-3 py-2 text-sm font-semibold text-[var(--amber)]"
            >
              {formErrors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}
          {generate.isError && (
            <p role="alert" className="mt-4 rounded-[var(--radius)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
              {t.serviceError}
            </p>
          )}

          <button
            type="submit"
            disabled={generate.isPending}
            className="mt-5 min-h-[52px] w-full rounded-[var(--radius)] bg-[var(--accent)] text-lg font-bold text-white disabled:opacity-60"
          >
            {generate.isPending ? t.generating : t.generate}
          </button>
          <p className="mt-3 text-xs text-[var(--dim)]">{t.engineNote}</p>
        </form>

        {/* Failure path — the coordinator says plainly what it could not do */}
        {failure && (
          <section
            aria-label={t.failureTitle}
            className="mt-8 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] p-4"
            role="alert"
          >
            <h2 className="font-serif text-2xl">{t.failureTitle}</h2>
            <p className="mt-1 font-semibold">{lang === "en" ? failure.titleEn : failure.titleEs}</p>
            <div className="mt-3 flex flex-col gap-2">
              {failure.reasons.map((r, i) => (
                <p key={i} className="text-base">{lang === "en" ? r.en : r.es}</p>
              ))}
            </div>
            {failure.couldDo.length > 0 && (
              <>
                <h3 className="mt-4 font-serif text-lg">{t.couldDoTitle}</h3>
                <ul className="mt-1 list-disc pl-5">
                  {failure.couldDo.map((r, i) => (
                    <li key={i} className="text-base">{lang === "en" ? r.en : r.es}</li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="mt-4 font-serif text-lg">{t.couldNotTitle}</h3>
            <ul className="mt-1 list-disc pl-5">
              {failure.couldNot.map((r, i) => (
                <li key={i} className="text-base">{lang === "en" ? r.en : r.es}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold">{t.failureHint}</p>
          </section>
        )}

        {/* Plan result */}
        {plan && (
          <section aria-label={lang === "en" ? "Your meal plan" : "Tu plan de comida"} className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-serif text-2xl">{lang === "en" ? plan.titleEn : plan.titleEs}</h2>
              <button
                type="button"
                onClick={copyPlan}
                className="min-h-[44px] shrink-0 rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 text-sm font-bold text-[var(--accent)]"
              >
                {copied ? t.copied : t.copyPlan}
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--dim)]">
              {t.equipAssumed}:{" "}
              {lang === "en"
                ? (EQUIPMENT.find((e) => e.id === plan.equipment)?.en ?? plan.equipment ?? "")
                : (EQUIPMENT.find((e) => e.id === plan.equipment)?.es ?? plan.equipment ?? "")}
              {" · "}
              {plan.currency ?? "USD"}
            </p>

            <div
              className={`mt-3 rounded-[var(--radius)] border px-4 py-3 ${
                plan.verdict === "over"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--green)] bg-[var(--green-soft)]"
              }`}
              role="status"
            >
              <p className="text-lg font-bold">
                {t.estTotal}: {planMoney(plan.totalCents)} · {t.budgetLine}: {planMoney(plan.budgetCents)}
              </p>
              <p className="mt-1 text-base font-semibold">
                {plan.verdict === "under" && `${t.underBy} ${planMoney(plan.diffCents)}`}
                {plan.verdict === "over" && `${t.overBy} ${planMoney(-plan.diffCents)}`}
                {plan.verdict === "exact" && t.exactBudget}
                {" · "}
                {planMoney(plan.perPersonCents)} {t.perPerson}
              </p>
              {plan.cheapestFix && (
                <p className="mt-2 text-sm">{lang === "en" ? plan.cheapestFix.en : plan.cheapestFix.es}</p>
              )}
            </div>

            {plan.allergyNote && (
              <div
                role="alert"
                className="mt-3 rounded-[var(--radius)] border border-[var(--amber)] bg-[var(--amber-soft)] px-4 py-3"
              >
                <p className="text-base font-bold text-[var(--amber)]">⚠ {t.allergyBannerTitle}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {(plan.allergyFlags ?? []).map((f, i) => (
                    <p key={i} className="text-sm font-semibold">
                      {lang === "en" ? f.en : f.es}
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {lang === "en" ? plan.allergyNote.en : plan.allergyNote.es}
                </p>
              </div>
            )}

            {plan.warnings.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {plan.warnings.map((w, i) => (
                  <p key={i} className="rounded-[var(--radius)] bg-[var(--amber-soft)] px-3 py-2 text-sm font-medium text-[var(--amber)]">
                    {lang === "en" ? w.en : w.es}
                  </p>
                ))}
              </div>
            )}

            <h3 className="mt-6 font-serif text-xl">{t.menuTitle}</h3>
            <div className="mt-2 flex flex-col gap-3">
              {plan.dishes.map((dish, i) => (
                <article key={i} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">{dishKindLabel(dish.kind)}</p>
                  <h4 className="mt-1 text-lg font-semibold">{lang === "en" ? dish.nameEn : dish.nameEs}</h4>
                  <p className="text-sm text-[var(--dim)]">
                    {dish.servings} {t.servings}
                  </p>
                  <p className="mt-2 text-sm">{lang === "en" ? dish.cookEn : dish.cookEs}</p>
                  {dish.satisfiesEn.length > 0 && dish.conflictsEn.length === 0 && (
                    <p className="mt-2 text-sm font-semibold text-[var(--green)]">
                      ✓ {t.satisfies}: {(lang === "en" ? dish.satisfiesEn : dish.satisfiesEs).join(", ")}
                    </p>
                  )}
                  {dish.conflictsEn.length > 0 && (
                    <p className="mt-2 text-sm font-semibold text-[var(--accent)]">
                      ✗ {t.conflicts}: {(lang === "en" ? dish.conflictsEn : dish.conflictsEs).join(", ")}
                    </p>
                  )}
                </article>
              ))}
            </div>
            {plan.usedOnHand.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-semibold">{t.usedOnHand}:</span>{" "}
                {plan.usedOnHand.map((u) => (lang === "en" ? u.en : u.es)).join(", ")}
              </p>
            )}
            {plan.unmatchedOnHand.length > 0 && (
              <p className="mt-1 text-sm text-[var(--dim)]">
                <span className="font-semibold">{t.unmatched}:</span> {plan.unmatchedOnHand.join(", ")}
              </p>
            )}

            <h3 className="mt-6 font-serif text-xl">{t.groceryTitle}</h3>
            <p className="mt-1 text-sm text-[var(--dim)]">{t.groceryNote}</p>

            {haveLines.length > 0 && (
              <>
                <h4 className="mt-4 text-base font-bold text-[var(--green)]">{t.haveTitle}</h4>
                <ul className="mt-2 divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                  {haveLines.map((line, i) => (
                    <li key={i} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{lang === "en" ? line.itemEn : line.itemEs}</span>
                        <span className="font-bold">{planMoney(0)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--dim)]">
                        {qtyFmt(line.onHandApplied)} {lang === "en" ? line.unitEn : line.unitEs} {t.onHandApplied}
                        {" · "}
                        {t.needCol}: {qtyFmt(line.needed)} {lang === "en" ? line.unitEn : line.unitEs}
                      </p>
                      <p className="text-sm font-semibold text-[var(--green)]">
                        {line.coveredByOnHand ? `✓ ${t.covered}` : t.coversPart}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h4 className="mt-4 text-base font-bold">{t.buyTitle}</h4>
            {buyLines.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-[var(--green)]">✓ {t.covered}</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                {buyLines.map((line, i) => (
                  <li key={i} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{lang === "en" ? line.itemEn : line.itemEs}</span>
                      <span className="font-bold">{planMoney(line.lineTotalCents)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--dim)]">
                      {t.needCol}: {qtyFmt(line.needed)} {lang === "en" ? line.unitEn : line.unitEs}
                      {line.onHandApplied > 0 &&
                        ` · ${qtyFmt(line.onHandApplied)} ${lang === "en" ? line.unitEn : line.unitEs} ${t.onHandApplied}`}
                      {" · "}
                      {t.buyCol}: {qtyFmt(line.buyQty)} {lang === "en" ? line.unitEn : line.unitEs}
                      {` · ${t.estCol} ${planMoney(line.unitCostCents)}/${lang === "en" ? line.unitEn : line.unitEs}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-6 font-serif text-xl">{t.checklistTitle}</h3>
            <ol className="mt-2 flex flex-col gap-2">
              {plan.checklist.map((stepItem, i) => {
                const phase = lang === "en" ? stepItem.phaseEn : stepItem.phaseEs;
                const prevPhase = i > 0 ? (lang === "en" ? plan.checklist[i - 1]?.phaseEn : plan.checklist[i - 1]?.phaseEs) : null;
                const isDone = checked.has(i);
                return (
                  <li key={i}>
                    {phase !== prevPhase && (
                      <p className="mb-1 mt-3 text-sm font-bold uppercase tracking-wide text-[var(--accent)]">{phase}</p>
                    )}
                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() =>
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                        aria-label={`${phase} — ${i + 1}`}
                        className="mt-1 h-5 w-5 shrink-0"
                      />
                      <span className={`text-base ${isDone ? "text-[var(--dim)] line-through" : ""}`}>
                        {lang === "en" ? stepItem.en : stepItem.es}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* Saved plans */}
        <section aria-label={t.savedTitle} className="mt-10">
          <h2 className="font-serif text-xl">{t.savedTitle}</h2>
          {saved.isPending && <p className="mt-2 text-sm text-[var(--dim)]">…</p>}
          {saved.data && saved.data.plans.length === 0 && <p className="mt-2 text-sm text-[var(--dim)]">{t.noSaved}</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {saved.data?.plans.map((p) => {
              const pMoney = (cents: number) => `${symbolFor(p.currency)}${(cents / 100).toFixed(2)}`;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-[var(--dim)]">
                      {new Date(p.created_at).toLocaleString(lang === "en" ? "en-US" : "es-US")} · {pMoney(p.total_cents)} /{" "}
                      {pMoney(p.budget_cents)} · {p.headcount} {t.servings}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSaved.mutate(p.id)}
                    className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-semibold"
                  >
                    {t.load}
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.deletePlan}: ${p.title}`}
                    onClick={() => remove.mutate(p.id)}
                    className="min-h-[44px] rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-semibold text-[var(--accent)]"
                  >
                    {t.deletePlan}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Status & submission prep */}
        <section aria-label={t.prepTitle} className="mt-10 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <button
            type="button"
            aria-expanded={showPrep}
            onClick={() => setShowPrep((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between text-left font-serif text-lg font-semibold"
          >
            {t.prepTitle}
            <span aria-hidden="true">{showPrep ? "−" : "+"}</span>
          </button>
          {showPrep && (
            <div className="mt-2 flex flex-col gap-2 text-sm">
              <p className="font-semibold">{t.prepAiTitle}</p>
              <p>{t.prepAiRunning}</p>
              <p>{t.prepAiNot}</p>
              <p>{t.prepSolo}</p>
              <p>{t.prepTrack}</p>
              <p className="font-semibold">{t.prepCreditsTitle}</p>
              <p>{t.prepCredits1}</p>
              <p>{t.prepCredits2}</p>
              <p>{t.prepCredits3}</p>
              <p>{t.prepCredits4}</p>
              <p className="font-semibold">{t.prepDeadline}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
