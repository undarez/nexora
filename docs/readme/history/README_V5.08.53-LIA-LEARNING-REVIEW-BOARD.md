# V5.08.53 — LIA Learning Review Board

NEXORA adds an admin-only governance board for learning candidates produced by feedback, self-evaluation and replay.

## Flow

`feedback / learning candidate → evaluation → replay → review board → human decision → next governance step`

Approval is **not activation**. The board never updates model weights, financial facts, policies, permissions or skill activation.

## Security

- admin-only API and page;
- review transitions are limited to pending records;
- reviewer identity and timestamp are stored;
- authority flags are explicitly false;
- no raw financial/model content is required by the board.
