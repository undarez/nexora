# NEXORA Brain local autonome

## Objectif

Faire fonctionner un petit LLM local sur un PC gamer courant, tout en conservant les garde-fous financiers de NEXORA côté serveur.

Le modèle n'est pas l'agent. Le modèle raisonne et choisit des outils ; NEXORA garde l'identité utilisateur, les permissions, les données financières et l'autorité d'exécution.

## Architecture

```text
Utilisateur
   |
   v
Next.js /api/lia/autonomous-agent
   |
   +--> boucle bornée (1 outil à la fois, 8 itérations max)
   |
   +--> NEXORA Brain (OpenAI-compatible)
   |       |
   |       +--> llama.cpp / llama-server
   |       +--> GGUF local
   |
   +--> executeAgentTool()
           |
           +--> Policy Engine Supabase
           +--> outils financiers en lecture
           +--> mémoire / skills / use cases
           +--> blocage des actions sensibles
```

## Modèle de départ

Profil minimal recommandé : **Qwen3.5 4B Q4_K_M**. Un GGUF Q4_K_M est d'environ 2.7 Go et peut être servi directement avec llama.cpp. Pour une machine plus musclée, remplacer uniquement le modèle par une quantification 5/6/8 bits ou un 9B.

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

La boucle ne donne au modèle que des outils autorisés. Les outils d'écriture sensible restent bloqués par `executeAgentTool()` et par le Policy Engine Supabase.

## Ce que signifie « autonome » ici

- planification locale par LLM ;
- sélection dynamique d'outils ;
- observation des résultats ;
- réévaluation après chaque étape ;
- mémoire et apprentissage procédural via les systèmes LIA existants ;
- arrêt automatique après un budget d'itérations ;
- arrêt avec `needs_human` lorsqu'une autorisation humaine est nécessaire.

Ce n'est volontairement pas un LLM entraîné depuis zéro. Les poids sont ceux d'un modèle open-weight et l'autonomie vient de la couche agentique, de la mémoire, des outils, de la politique d'autorisation et de la boucle d'exécution.
