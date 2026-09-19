# Budget Intelligence Loop v1

## Mission
Maintain a traceable, source-first knowledge layer for a household-budget AI operating in France and the EU.

## Daily pipeline
1. Search official sources first: INSEE, Banque de France, BCE/ECB, Eurostat, Service-Public.fr, economie.gouv.fr, CRE, CNIL, ANSSI, EDPB and EUR-Lex when relevant.
2. Search the last 24h/7d depending on topic.
3. Deduplicate by event + indicator + publication date.
4. Extract fact, source, publication date, effective date, jurisdiction and status.
5. Never merge an estimate with a definitive value.
6. Never turn an official statistic into personalized financial advice.
7. Preserve effective dates and scope for regulations.
8. Use household data for household impact.
9. Store changed values as new observations.
10. Generate a concise digest with implications and educational context.

## Reasoning rules
- Transaction != expense.
- Transfer between own accounts != consumption.
- Payment installment = current expense + future commitment.
- Subscription = recurring commitment.
- Credit = liability + future cash-flow schedule.
- Overdraft = liquidity event; track frequency and duration.
- Macro indicator != household diagnosis.
- Anticipation != forecast.
- Scenario != fact.
- Never diagnose over-indebtedness from transactions alone.
- Never recommend a financial product as a personalized action.
