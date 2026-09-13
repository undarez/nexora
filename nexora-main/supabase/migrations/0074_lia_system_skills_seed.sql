-- v5.06.5: seed the governed system skills required by active LIA Use Cases.
-- Skills are procedural knowledge only; they never grant permissions.
DO $$
DECLARE
  item jsonb;
  v_skill_id uuid;
  v_content text;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements($skills$[
    {"slug":"financial-analysis","name":"Analyse financière","description":"Analyser une situation financière à partir de données observées et distinguer faits, hypothèses et incertitudes.","category":"analysis"},
    {"slug":"cashflow-analysis","name":"Analyse du cash-flow","description":"Analyser les entrées, sorties et trajectoires de trésorerie sans modifier les données réelles.","category":"analysis"},
    {"slug":"scenario-analysis","name":"Analyse de scénarios","description":"Comparer plusieurs scénarios financiers avec hypothèses explicites et résultats vérifiables.","category":"simulation"},
    {"slug":"risk-analysis","name":"Analyse des risques financiers","description":"Identifier et hiérarchiser les risques financiers à partir de preuves disponibles.","category":"risk"},
    {"slug":"budget-analysis","name":"Analyse budgétaire","description":"Comparer budget, réalisé et trajectoire afin d’identifier les écarts pertinents.","category":"budget"},
    {"slug":"variance-analysis","name":"Analyse des écarts","description":"Quantifier les écarts entre prévu et réel et rechercher des explications vérifiables.","category":"budget"},
    {"slug":"financial-coaching","name":"Coaching financier","description":"Transformer une analyse financière en priorités compréhensibles et non destructives.","category":"coaching"},
    {"slug":"spending-detection","name":"Détection des dépenses","description":"Détecter des variations de rythme de dépenses à partir des transactions observées.","category":"alerts"},
    {"slug":"anomaly-analysis","name":"Analyse des anomalies","description":"Évaluer les anomalies en tenant compte du contexte et des dépenses exceptionnelles.","category":"alerts"},
    {"slug":"forecast-analysis","name":"Analyse prévisionnelle","description":"Interpréter une prévision financière en séparant données observées et hypothèses.","category":"forecast"},
    {"slug":"sensitivity-analysis","name":"Analyse de sensibilité","description":"Mesurer l’effet de variations d’hypothèses sur une trajectoire financière.","category":"simulation"},
    {"slug":"error-analysis","name":"Analyse des erreurs","description":"Identifier la cause d’une erreur, sa correction et les conditions de reproductibilité.","category":"learning"},
    {"slug":"skill-learning","name":"Apprentissage procédural","description":"Transformer une correction validée en compétence candidate sans modifier automatiquement les permissions.","category":"learning"},
    {"slug":"verification","name":"Vérification déterministe","description":"Vérifier les résultats attendus, les preuves et les garde-fous avant réutilisation.","category":"verification"},
    {"slug":"verification-rules","name":"Règles de vérification","description":"Construire et appliquer des contrôles explicites pour éviter les données inventées et les conclusions non vérifiées.","category":"verification"}
  ]$skills$::jsonb)
  LOOP
    INSERT INTO public.lia_skills(user_id,scope,slug,name,description,category,status,source_type,trust_score,last_validated_at)
    VALUES(NULL,'global',item->>'slug',item->>'name',item->>'description',item->>'category','active','system',95,now())
    ON CONFLICT(scope,user_id,slug) DO UPDATE SET
      name=excluded.name, description=excluded.description, category=excluded.category, status='active', source_type='system', trust_score=greatest(public.lia_skills.trust_score,excluded.trust_score), last_validated_at=now(), updated_at=now()
    RETURNING id INTO v_skill_id;

    v_content := format('# %s\n\n## When to Use\n%s\n\n## Procedure\n1. Charger uniquement les données disponibles.\n2. Séparer les faits, hypothèses et incertitudes.\n3. Produire un résultat vérifiable.\n4. Ne jamais contourner le Policy Engine.\n\n## Verification\n- Vérifier les entrées et les hypothèses.\n- Vérifier la cohérence du résultat avant réutilisation.\n\n## Pitfalls\n- Ne jamais inventer une donnée.\n- Ne jamais transformer une compétence en permission.', item->>'name', item->>'description');

    INSERT INTO public.lia_skill_versions(skill_id,version,content,content_hash,trigger_context,expected_result,verification_steps,failure_modes,source_refs,memory_gate,created_by)
    VALUES(v_skill_id,1,v_content,encode(digest(v_content,'sha256'),'hex'),'{}','Résultat vérifiable.','["Entrées vérifiées","Hypothèses séparées","Résultat contrôlé"]','["Donnée inventée","Permission contournée"]','[]','{"useful":true,"reliable":true,"reproducible":true,"generalizable":true,"obsolete":false,"evidence_required":false}','system')
    ON CONFLICT(skill_id,version) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,verification_steps=excluded.verification_steps,failure_modes=excluded.failure_modes,memory_gate=excluded.memory_gate;
  END LOOP;
END $$;
