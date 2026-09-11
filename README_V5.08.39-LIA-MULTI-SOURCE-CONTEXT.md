# NEXORA V5.08.39 — LIA Multi-Source Context

## Objectif
Relier proprement les sources financières, la messagerie Gmail/Outlook et le contexte conversationnel sans mélanger leur niveau de fiabilité.

## Hiérarchie
- Données financières observées : source de vérité pour les faits financiers.
- Métadonnées Gmail/Outlook : signaux, jamais preuves comptables à elles seules.
- Conversation : contexte, jamais donnée financière de référence.

## Garde-fous
- lecture seule ;
- corps et pièces jointes email exclus ;
- aucune autorisation d'action ;
- faits, signaux et projections séparés ;
- aucune donnée absente n'est inventée.

## Test
```bash
npm run lia:multi-source
```
