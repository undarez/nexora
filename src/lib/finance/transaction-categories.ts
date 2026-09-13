import {
  Banknote,
  Car,
  Film,
  Gift,
  HeartPulse,
  Home,
  Package,
  PiggyBank,
  Plane,
  ReceiptText,
  Repeat2,
  ShoppingCart,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type TransactionCategoryKey =
  | "food"
  | "restaurants"
  | "housing"
  | "bills"
  | "transport"
  | "health"
  | "shopping"
  | "subscriptions"
  | "leisure"
  | "travel"
  | "fees"
  | "savings"
  | "income"
  | "transfer"
  | "other";

export type TransactionCategoryDefinition = {
  key: TransactionCategoryKey;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  badgeClass: string;
  keywords: string[];
};

export const TRANSACTION_CATEGORIES: TransactionCategoryDefinition[] = [
  { key: "food", label: "Courses & alimentation", icon: ShoppingCart, iconClass: "text-emerald-600 dark:text-emerald-400", badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", keywords: ["course", "supermarche", "carrefour", "auchan", "leclerc", "lidl", "intermarche", "monoprix", "casino", "aldi", "picard", "boulangerie", "market"] },
  { key: "restaurants", label: "Restaurants", icon: Utensils, iconClass: "text-orange-600 dark:text-orange-400", badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-300", keywords: ["restaurant", "resto", "uber eats", "ubereats", "deliveroo", "just eat", "mcdo", "mcdonald", "burger", "pizza", "kebab", "sushi", "starbucks", "coffee"] },
  { key: "housing", label: "Logement", icon: Home, iconClass: "text-blue-600 dark:text-blue-400", badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300", keywords: ["loyer", "rent", "logement", "agence immobiliere", "charges locatives"] },
  { key: "bills", label: "Factures & énergie", icon: ReceiptText, iconClass: "text-yellow-600 dark:text-yellow-400", badgeClass: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300", keywords: ["edf", "engie", "electricite", "gaz", "eau", "veolia", "internet", "orange", "free", "sfr", "bouygues", "facture", "energie"] },
  { key: "transport", label: "Transport", icon: Car, iconClass: "text-cyan-600 dark:text-cyan-400", badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", keywords: ["essence", "carburant", "station", "total", "shell", "esso", "bp", "peage", "autoroute", "sncf", "ratp", "uber", "taxi", "parking", "garage"] },
  { key: "health", label: "Santé", icon: HeartPulse, iconClass: "text-rose-600 dark:text-rose-400", badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300", keywords: ["pharmacie", "pharmacy", "medecin", "docteur", "dentiste", "hopital", "clinique", "sante", "mutuelle", "optique"] },
  { key: "shopping", label: "Shopping", icon: Gift, iconClass: "text-pink-600 dark:text-pink-400", badgeClass: "bg-pink-500/10 text-pink-700 dark:text-pink-300", keywords: ["amazon", "fnac", "darty", "decathlon", "ikea", "zara", "h&m", "kiabi", "shopping", "boutique", "vetement"] },
  { key: "subscriptions", label: "Abonnements", icon: Repeat2, iconClass: "text-violet-600 dark:text-violet-400", badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300", keywords: ["netflix", "spotify", "prime", "canal", "disney", "deezer", "apple music", "icloud", "adobe", "abonnement", "subscription"] },
  { key: "leisure", label: "Loisirs", icon: Film, iconClass: "text-fuchsia-600 dark:text-fuchsia-400", badgeClass: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300", keywords: ["cinema", "cine", "theatre", "concert", "bar", "jeux", "steam", "playstation", "xbox", "loisir", "sport"] },
  { key: "travel", label: "Voyages", icon: Plane, iconClass: "text-sky-600 dark:text-sky-400", badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300", keywords: ["airbnb", "hotel", "booking", "voyage", "air france", "easyjet", "ryanair", "train", "vol"] },
  { key: "fees", label: "Frais bancaires", icon: Banknote, iconClass: "text-slate-600 dark:text-slate-300", badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300", keywords: ["frais bancaire", "commission", "cotisation", "agios", "commission carte", "frais"] },
  { key: "savings", label: "Épargne", icon: PiggyBank, iconClass: "text-teal-600 dark:text-teal-400", badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-300", keywords: ["epargne", "livret", "pea", "investissement", "placement"] },
  { key: "income", label: "Revenus", icon: Banknote, iconClass: "text-green-600 dark:text-green-400", badgeClass: "bg-green-500/10 text-green-700 dark:text-green-300", keywords: ["salaire", "paie", "payroll", "prime salaire", "revenu", "remuneration"] },
  { key: "transfer", label: "Transferts", icon: WalletCards, iconClass: "text-indigo-600 dark:text-indigo-400", badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", keywords: ["virement", "transfer", "transfert", "versement"] },
  { key: "other", label: "Autres", icon: Package, iconClass: "text-gray-600 dark:text-gray-300", badgeClass: "bg-gray-500/10 text-gray-700 dark:text-gray-300", keywords: [] },
];

const normalize = (value: string) => value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function classifyTransaction(input: { label?: string | null; description?: string | null; merchant?: string | null; providerCategory?: string | null; amount?: number | null }) {
  const amount = Number(input.amount ?? 0);
  const haystack = normalize([input.merchant, input.label, input.description, input.providerCategory].filter(Boolean).join(" "));
  if (amount > 0 && /\b(salaire|paie|payroll|remuneration|revenu)\b/.test(haystack)) return TRANSACTION_CATEGORIES.find((x) => x.key === "income")!;
  const match = TRANSACTION_CATEGORIES.find((category) => category.key !== "other" && category.key !== "income" && category.keywords.some((keyword) => haystack.includes(normalize(keyword))));
  return match ?? (amount > 0 ? TRANSACTION_CATEGORIES.find((x) => x.key === "income")! : TRANSACTION_CATEGORIES.find((x) => x.key === "other")!);
}

export function categoryDefinition(value?: string | null) {
  const n = normalize(String(value ?? ""));
  const aliases: Record<string, TransactionCategoryKey> = {
    "courses": "food", "alimentation": "food", "courses & alimentation": "food", "logement / charges": "housing",
    "carburant": "transport", "abonnements": "subscriptions", "loisirs": "leisure", "sante": "health",
    "transport": "transport", "salaire": "income", "autres revenus": "income", "restaurant": "restaurants",
    "factures": "bills", "frais bancaires": "fees", "epargne": "savings", "transferts": "transfer",
  };
  const key = aliases[n] ?? (n as TransactionCategoryKey);
  return TRANSACTION_CATEGORIES.find((x) => x.key === key || normalize(x.label) === n) ?? TRANSACTION_CATEGORIES.find((x) => x.key === "other")!;
}
