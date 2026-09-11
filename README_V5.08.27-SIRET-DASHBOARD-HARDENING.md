# V5.08.27 — SIRET obligatoire & dashboard key hardening

- L’accès `/entreprise` est désormais bloqué côté serveur tant qu’aucun espace business actif ne possède un SIRET français de 14 chiffres avec `verification_status = verified`.
- L’onboarding entreprise vérifie le SIRET localement (clé de contrôle) puis auprès du registre officiel `recherche-entreprises.api.gouv.fr`.
- Un utilisateur peut conserver son espace personnel et créer ensuite un espace entreprise : l’ancien comportement qui renvoyait systématiquement le premier workspace a été corrigé.
- Le dashboard particulier utilise désormais une clé React de repli lorsque les engagements fixes ont un `id` vide ou nul.
