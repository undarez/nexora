# NEXORA — Process Logigrams

## Main agent loop

User
→ Understand
→ Define goal
→ Plan
→ Select Skill
→ Select tool
→ Check permission
→ Execute
→ Observe result
→ Evaluate
→ Success? 
→ yes: learn/update/audit → respond
→ no: diagnose → retry if bounded → otherwise stop safely

## Permission flow

Request
→ classify impact
→ policy check
→ permission available?
→ no: refuse/ask approval
→ yes: execute
→ audit

## Anomaly flow

Detection
→ reproduce
→ classify severity
→ assign owner
→ fix
→ regression test
→ verification
→ close

## Release flow

Implementation
→ static checks
→ unit tests
→ integration tests
→ security tests
→ acceptance
→ audit
→ release decision
