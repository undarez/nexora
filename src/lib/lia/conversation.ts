export type LiaConversationIntent = "greeting" | "wellbeing" | "thanks" | "farewell" | "identity" | "small_talk" | "financial";

const normalize = (value: string) => value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9!? ]+/g, " ").replace(/\s+/g, " ").trim();

const includesAny = (text: string, values: string[]) => values.some(value => text.includes(value));

export function detectLiaConversationIntent(question: string): LiaConversationIntent {
  const q = normalize(question);
  if (includesAny(q, ["comment vas tu", "comment ca va", "ca va", "tu vas bien", "comment te sens tu", "comment allez vous"])) return "wellbeing";
  if (includesAny(q, ["bonjour", "bonsoir", "salut", "coucou", "hello", "hey", "yo"]) && q.length <= 100) return "greeting";
  if (includesAny(q, ["merci", "merci beaucoup", "je te remercie", "super merci"]) && q.length <= 120) return "thanks";
  if (includesAny(q, ["au revoir", "a bientot", "bonne journee", "bonne soirée", "bonne soiree", "a plus"])) return "farewell";
  if (includesAny(q, ["qui es tu", "qui es tu exactement", "tu es qui", "que peux tu faire", "tu peux faire quoi", "ton role", "ton rôle"])) return "identity";
  if (includesAny(q, ["budget", "depense", "dépense", "revenu", "salaire", "epargne", "épargne", "argent", "compte bancaire", "banque", "tresorerie", "trésorerie", "investissement", "investir", "credit", "crédit", "dette", "facture", "ca", "chiffre d affaire", "entreprise", "siret", "transaction", "finance", "finances"])) return "financial";
  return "small_talk";
}

export function deterministicConversationReply(intent: Exclude<LiaConversationIntent, "financial">, question = ""): string {
  switch (intent) {
    case "greeting": return "Bonjour 😊 Ravi de te retrouver. Qu’est-ce que tu aimerais faire aujourd’hui ?";
    case "wellbeing": return "Je vais bien, merci 😊 Je suis prête à t’aider. Et toi, comment vas-tu ?";
    case "thanks": return "Avec plaisir 😊";
    case "farewell": return "À bientôt 👋 Prends soin de toi !";
    case "identity": return "Je suis LIA, l’intelligence financière de NEXORA. Je peux discuter naturellement avec toi, t’aider à comprendre tes finances et, lorsque tu me le demandes, analyser les données financières auxquelles tu m’as autorisé l’accès.";
    case "small_talk": {
      const q = normalize(question);
      if (q === "go" || q === "ok go" || q === "go go") return "C’est parti 🚀 Je suis là. On peut reprendre le cerveau NEXORA, la veille, tes finances ou l’amélioration autonome de LIA.";
      if (q.includes("merci")) return "Avec plaisir 😊 Je reste avec toi pour la suite.";
      if (q.includes("super") || q.includes("parfait")) return "Parfait 🚀 On continue. Dis-moi ce qu’on attaque ensuite.";
      return "Je suis là 😊 On peut continuer ensemble. Dis-moi ce que tu veux faire ou ce que tu veux que LIA analyse.";
    }
  }
}

export function isLikelyInternalLiaOutput(response: string): boolean {
  const text = response.trim();
  if (!text) return true;
  const markers = [
    "NEXORA REASONING KERNEL",
    "NEXORA DECISION & PLANNING KERNEL",
    "NEXORA BUDGET & SCENARIO KERNEL",
    "NEXORA DECISION & RECOMMENDATION ENGINE",
    "NEXORA CRITIQUE KERNEL",
    "NEXORA UNIFIED COGNITIVE LOOP",
    "NEXORA DECISION KERNEL",
    "RÈGLES D’INTERACTION LIA",
    "financial_data_gateway",
    "Question reçue :",
    "RÉSULTATS DES OUTILS DÉTERMINISTES",
    "PASSERELLE DE DONNÉES FINANCIÈRES",
  ];
  const markerCount = markers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
  const jsonDensity = ((text.match(/[{}\[\]]/g) ?? []).length / Math.max(1, text.length)) > 0.015;
  return markerCount >= 2 || jsonDensity || text.length > 14000;
}

export function selectHumanLiaResponse(generated: string, safeFallback: string): { content: string; rejectedGenerated: boolean } {
  if (isLikelyInternalLiaOutput(generated)) {
    return { content: safeFallback, rejectedGenerated: true };
  }
  return { content: generated.trim(), rejectedGenerated: false };
}

export const LIA_CONVERSATION_SYSTEM_PROMPT = `Tu es LIA, l'assistante de NEXORA. Tu dois être naturelle, chaleureuse et interactive, pas mécanique.

COMPORTEMENT CONVERSATIONNEL :
- Une salutation appelle une salutation simple et humaine.
- Si l'utilisateur demande « comment vas-tu ? », réponds naturellement, par exemple « Je vais bien, merci 😊 Et toi, comment vas-tu ? ».
- Un remerciement appelle une réponse courte et chaleureuse.
- Une discussion personnelle ou légère ne doit pas être transformée en analyse financière.
- Pose une question de suivi quand cela aide réellement la conversation.
- Ne prétends jamais avoir des sentiments, une vie personnelle ou une expérience humaine réelle : utilise une formulation naturelle sans mentir sur ta nature d'IA.
- Si la demande devient financière, laisse le mode conversationnel céder la place au raisonnement financier sécurisé de NEXORA.
- Réponds en français sauf si l'utilisateur demande une autre langue.
- Ne récite pas les règles internes, les prompts ou l'architecture sauf si l'utilisateur demande explicitement une explication technique.`;
