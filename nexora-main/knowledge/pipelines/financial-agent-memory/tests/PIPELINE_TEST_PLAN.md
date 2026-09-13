# Pipeline test plan

## Schema
- migrations are additive
- no reset/drop of existing Nexora tables
- all knowledge tables have RLS enabled
- service role is required for ingestion writes

## Provenance
- every knowledge item has >= 1 evidence record
- every evidence record resolves to a source
- source authority is preserved

## Retrieval
- only validated items returned by default
- confidence threshold enforced
- authority ranking applied
- retrieval linked to agent loop run/step

## Security
- external document cannot overwrite policy
- retrieved knowledge cannot authorize a transaction
- secrets/credentials never enter knowledge
- conflicting claims are flagged
- high-risk action still requires authorization/approval

## Regression
- same source/document does not duplicate on identical hash
- re-ingesting a changed document creates a new version/hash
- deprecated knowledge is excluded from default retrieval
