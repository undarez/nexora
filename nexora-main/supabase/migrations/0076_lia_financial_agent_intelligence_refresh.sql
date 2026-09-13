-- v5.06.12: refresh the integrated Financial Agent Intelligence skill with explicit evidence-before-action protocol.
DO $$
DECLARE v_skill_id uuid; v_content text;
BEGIN
  SELECT id INTO v_skill_id FROM public.lia_skills WHERE scope='global' AND slug='financial-agent-intelligence' ORDER BY updated_at DESC LIMIT 1;
  IF v_skill_id IS NULL THEN RAISE EXCEPTION 'financial_agent_intelligence_skill_missing'; END IF;
  SELECT content INTO v_content FROM public.lia_skill_versions WHERE skill_id=v_skill_id AND version=2 LIMIT 1;
  IF position('## Evidence before action' in coalesce(v_content,'')) = 0 THEN
    v_content := coalesce(v_content,'') || E'\n\n## Evidence before action\nBefore a consequential financial action, identify user authorization/policy, relevant financial facts, applicable constraints, supporting source evidence, risk level, expected consequence, approval requirement and execution result.\n';
  END IF;
  UPDATE public.lia_skill_versions SET content=v_content, content_hash=encode(digest(v_content,'sha256'),'hex'), updated_at=now() WHERE skill_id=v_skill_id AND version=2;
  UPDATE public.lia_skills SET updated_at=now(), last_validated_at=now(), status='active', trust_score=greatest(trust_score,98) WHERE id=v_skill_id;
END $$;
