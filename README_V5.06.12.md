# NEXORA V5.06.12 — Financial Agent Intelligence v2 intégrée

Cette version intègre le skill financier `NEXORA-FINANCIAL-AGENT-INTELLIGENCE v2.0.0` dans le registre de compétences système de LIA.

## Intégration
- Skill global actif : `financial-agent-intelligence`
- Version de skill : 2
- Confiance système : 98/100
- Sources référencées : réglementation/institutions européennes, recherche académique et documentation technique listées dans `knowledge/skills/financial-agent-intelligence/source_registry.json`.
- Connaissances intégrées : boucle agentique, autonomie bornée, orchestration, sécurité des outils/MCP, sécurité mémoire, gestion de trésorerie, gouvernance IA, observabilité et évaluation.
- Protocole evidence-before-action intégré.

## Gouvernance
La connaissance n'accorde jamais une permission. Les actions financières sensibles restent soumises au Policy Engine et au Human Gate.

## Tests
`npm run lia:financial-agent-intelligence`
`npm run lia:financial-autopilot`
`npm run build`
