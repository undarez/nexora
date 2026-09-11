insert into public.lia_tool_policies(
  tool_key,
  risk_level,
  min_autonomy_level,
  human_approval_required,
  enabled
)
values
  ('search_use_cases', 'read', 0, false, true),
  ('search_skills', 'read', 0, false, true)
on conflict (tool_key) do update set
  risk_level = excluded.risk_level,
  min_autonomy_level = excluded.min_autonomy_level,
  human_approval_required = excluded.human_approval_required,
  enabled = true;