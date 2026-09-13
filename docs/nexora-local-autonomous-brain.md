# NEXORA Brain local autonome

## Objectif

Faire fonctionner un petit LLM local sur un PC gamer courant, tout en conservant les garde-fous financiers de NEXORA côté serveur.

Le modèle n'est pas l'agent. Le modèle raisonne et choisit des outils ; NEXORA garde l'identité utilisateur, les permissions, les données financières et l'autorité d'exécution.

## Architecture agentique actuelle

```text
Utilisateur
   |
   v
Nexo / Next.js
   |
   +--> Agent Harness / Governor
   |      +--> budget étapes / outils / temps
   |      +--> détection de répétition
   |      +--> trajectoire auditable
   |      +--> arrêt sécurisé
   |
   +--> NEXORA Brain (OpenAI-compatible)
   |      +--> llama.cpp / llama-server / autre runtime compatible
   |
   +--> Letta (optionnel, self-hosted)
   |      +--> mémoire persistante par utilisateur
   |      +--> contexte auxiliaire non autoritatif
   |
   +--> Skill Registry gouverné
   |      +--> finance / agentic / interaction / security / knowledge / voice
   |
   +--> Tool Registry
          |
          +--> Policy Engine Supabase
          +--> outils financiers
          +--> recherche web bornée
          +--> outils dynamiques read-only
          +--> Human Gate pour écritures sensibles

Nexo Voice Gateway
   +--> Hume Octave / EVI
   +--> ElevenLabs
```

## Harness

`src/lib/lia/agent-harness.ts` est le gouverneur d'exécution. Il ne remplace pas le Policy Engine : il ajoute une couche indépendante de limites et de contrôle de trajectoire.

Limites configurables :

```env
NEXORA_HARNESS_MAX_STEPS=12
NEXORA_HARNESS_MAX_TOOL_CALLS=10
NEXORA_HARNESS_MAX_WALL_MS=180000
NEXORA_HARNESS_MAX_REPEATED_CALLS=1
```

## Mémoire persistante Letta

Letta est optionnel et doit être activé explicitement. Le serveur Letta peut être auto-hébergé ; NEXORA ne lui délègue jamais les permissions financières.

```env
LETTA_ENABLED=false
LETTA_BASE_URL=http://127.0.0.1:8283
LETTA_API_KEY=
LETTA_MODEL=
```

Une identité Letta est liée à un seul utilisateur via `lia_memory_agents`. La mémoire ne doit contenir que du contexte utile ; les montants, soldes et autres faits financiers doivent être revérifiés dans Supabase via les outils autorisés.

## Skills

Le catalogue statique `src/lib/lia/skill-registry.ts` décrit les compétences disponibles à Nexo. Les compétences ne donnent aucune permission supplémentaire : elles orientent la sélection de capacités, tandis que l'exécuteur et la Policy Engine restent l'autorité.

Le registre couvre notamment : budget, cashflow, anomalies, récurrences, prévisions, scénarios, épargne, patrimoine, objectifs, risques, planification agentique, vérification, recherche web, fiabilité des sources, contradictions, contexte de page, friction, prompt injection, isolation des données, SSRF et voix.

Le registre persistant `src/lib/lia/skills/registry.ts` reste utilisé pour les skills appris et leur sélection contextuelle.

## Voix

Le Voice Gateway est serveur uniquement. Les clés ne sont jamais envoyées au navigateur.

```env
NEXORA_VOICE_PROVIDER=hume
HUME_API_KEY=
HUME_VOICE_ID=
HUME_VOICE_NAME=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_multilingual_v2
```

L'API exposée à l'application est `POST /api/lia/voice/synthesize`. Hume est le fournisseur par défaut ; ElevenLabs peut être sélectionné explicitement.

## Windows

1. Installer `llama.cpp` et vérifier que `llama-server.exe` est dans le PATH.
2. Depuis le dépôt :

```powershell
.\scripts\start-nexora-brain.ps1
```

3. Dans `.env.local` :

```env
NEXORA_BRAIN_API_URL=http://127.0.0.1:8080/v1
NEXORA_BRAIN_API_KEY=
NEXORA_BRAIN_MODEL=nexora-lia
LIA_PROVIDER_MODE=native_first
LIA_ALLOW_REMOTE_FALLBACK=false
```

4. Lancer NEXORA :

```powershell
npm run dev
```

## Endpoint agentique

`POST /api/lia/autonomous-agent`

Payload minimal :

```json
{
  "objective": "Analyse ma situation financière et trouve les trois priorités du mois.",
  "maxIterations": 5
}
```

Le copilote global utilise désormais le runtime agentique v4 avec le harness et, lorsqu'il est activé, la mémoire Letta.

## Tests

Régression minimale du harness :

```powershell
npm run lia:agent-harness
```

Puis, avant déploiement :

```powershell
npm run typecheck
npm run build
```

## Ce que signifie « autonome »

- planification locale par LLM ;
- sélection dynamique d'outils ;
- observation des résultats ;
- réévaluation après chaque étape ;
- mémoire persistante optionnelle ;
- skills gouvernés et réutilisables ;
- recherche web bornée et non fiable ;
- arrêt automatique par budget ;
- trajectoire enregistrable et contrôlable ;
- `needs_human` pour les opérations nécessitant une autorisation humaine.

Ce n'est volontairement pas un LLM entraîné depuis zéro. Les poids restent ceux du modèle d'inférence ; l'autonomie vient de la couche agentique, de la mémoire, des skills, des outils, de la politique d'autorisation, des évaluations et de la boucle d'exécution.
