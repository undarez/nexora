export type Mascot = {
  id: string;
  name: string;
  role: string;
  image: string;
};

export const MASCOTS: Mascot[] = [
  { id: "buddy-renard", name: "Buddy le Renard", role: "Stratège du budget", image: "/asset/mascots/buddy-renard.png" },
  { id: "cash-panda", name: "Cash le Panda", role: "Maître de l'équilibre", image: "/asset/mascots/cash-panda.png" },
  { id: "investor-loup", name: "Investor le Loup", role: "Visionnaire financier", image: "/asset/mascots/investor-loup.png" },
  { id: "goldy-chat", name: "Goldy le Chat", role: "Coach épargne", image: "/asset/mascots/goldy-chat.png" },
  { id: "captain-budget", name: "Captain Budget", role: "Gardien des finances", image: "/asset/mascots/captain-budget.png" },
  { id: "mecha-money", name: "Mecha Money", role: "Optimiseur financier", image: "/asset/mascots/mecha-money.png" },
  { id: "dragon-capital", name: "Dragon Capital", role: "Bâtisseur de patrimoine", image: "/asset/mascots/dragon-capital.png" },
  { id: "hoppy-tortue", name: "Hoppy la Tortue", role: "Discipline et régularité", image: "/asset/mascots/hoppy-tortue.png" },
  { id: "finny-requin", name: "Finny le Requin", role: "Instinct et opportunités", image: "/asset/mascots/finny-requin.png" },
  { id: "lumi-chouette", name: "Lumi la Chouette", role: "Sagesse financière", image: "/asset/mascots/lumi-chouette.png" },
];

export const DEFAULT_MASCOT_ID = "buddy-renard";
export const MASCOT_ENABLED_KEY = "gerer-finance:mascot-enabled";
export const MASCOT_ID_KEY = "gerer-finance:mascot-id";

export function getMascot(id: string) {
  return MASCOTS.find((m) => m.id === id) ?? MASCOTS[0];
}
