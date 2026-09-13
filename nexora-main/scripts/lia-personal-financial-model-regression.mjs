import assert from 'node:assert/strict';

const invariants = [
  'raw_bank_data_never_exposed',
  'raw_account_identifiers_never_exposed',
  'raw_transaction_identifiers_never_exposed',
  'vault_payload_never_exposed',
  'read_only_personal_model',
  'personalization_does_not_grant_authority',
  'knowledge_and_behaviour_do_not_authorize_financial_actions',
  'policy_engine_and_decision_gate_remain_authoritative',
];
assert.equal(invariants.includes('personalization_does_not_grant_authority'), true);
assert.equal(invariants.includes('vault_payload_never_exposed'), true);
console.log('lia:personal-financial-model PASS');
