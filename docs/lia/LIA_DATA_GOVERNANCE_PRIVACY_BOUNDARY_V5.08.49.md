# NEXORA V5.08.49 — LIA Data Governance & Privacy Boundary

## Objectif
Définir une frontière explicite entre les données financières, personnelles, sensibles, mémoire, messagerie, connaissances et contexte applicatif avant leur exposition à LIA.

## Hiérarchie
- `financial`: source de vérité pour les faits financiers.
- `personal`: uniquement lorsque nécessaire à la personnalisation autorisée.
- `sensitive`: serveur uniquement (secrets, tokens, identifiants sensibles).
- `memory`: contexte gouverné par consentement/expiration ; aucune autorité.
- `mail_metadata`: signal ; jamais une preuve comptable autonome.
- `knowledge`: contexte avec provenance ; aucune autorité.
- `context`: contexte conversationnel/applicatif.

## Minimisation
`governLiaPayload()` supprime les champs classés serveur/admin, borne profondeur et taille, et masque les IBAN/nombres longs présents dans les chaînes.

## Conservation
Les durées de conservation restent dépendantes de la politique du domaine concerné. Le registre ne remplace pas les politiques légales, les contrôles RLS ou l'authentification.

## Suppression / export
Les mécanismes de suppression et d'export existants restent la source opérationnelle. Cette version n'autorise aucune suppression automatique de données financières ou de mémoire.

## Règle centrale
**La classification gouverne l'exposition ; elle ne remplace jamais l'autorisation d'accès.**
