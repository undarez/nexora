# Nexora — test local de la couche IA

Cette archive contient les modifications de la couche Nexo suivantes :

- Agentic Harness borné intégré au runner autonome ;
- mémoire persistante Letta optionnelle et self-hosted ;
- catalogue de capacités/skills gouvernées ;
- Voice Gateway Hume / ElevenLabs ;
- bouton vocal directement dans Nexo ;
- migrations Supabase ;
- scripts de régression dédiés.

## 1. Installation

```powershell
npm install
```

## 2. Variables d'environnement

Copier `.env.example` vers `.env.local` et conserver vos valeurs Supabase/NEXORA existantes.

Pour tester Letta localement :

```env
LETTA_ENABLED=true
LETTA_BASE_URL=http://127.0.0.1:8283
LETTA_API_KEY=
LETTA_MODEL=
```

Letta reste optionnel : si désactivé ou indisponible, Nexora continue avec sa mémoire Supabase.

Pour tester la voix :

```env
NEXORA_VOICE_PROVIDER=hume
HUME_API_KEY=...
```

Alternative :

```env
NEXORA_VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL=eleven_multilingual_v2
```

Les clés sont uniquement côté serveur.

## 3. Supabase

Appliquer les migrations du dossier `supabase/migrations`, notamment :

`0120_letta_memory_and_agent_harness.sql`

## 4. Vérifications locales

```powershell
npm run typecheck
npm run lia:agent-harness
npm run lia:voice
npm run build
```

Si `typecheck` ou `build` échoue, conserver le premier message d'erreur complet : il permettra de corriger précisément la compatibilité avec votre environnement local.

## 5. Letta

Le mode recommandé pour un test gratuit/local est de faire tourner Letta sur le PC de développement et de laisser Nexora communiquer avec lui via `LETTA_BASE_URL`.

Nexo ne donne jamais à Letta l'autorité sur les permissions financières. Supabase reste la source de vérité pour les données financières et la Policy Engine reste souveraine pour les autorisations.

## 6. Sécurité

Le Harness limite la trajectoire mais n'accorde aucune permission.

L'architecture est :

Nexo → Harness → outils/skills → Policy Engine Supabase → données

Les écritures financières sensibles restent soumises aux garde-fous et à la validation humaine existants.
