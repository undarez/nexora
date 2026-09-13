-- NEXORA V5.08.24 — Admin knowledge validation.
create or replace function public.lia_admin_validate_financial_knowledge(p_knowledge_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare k public.financial_knowledge_items%rowtype;
begin
  select * into k from public.financial_knowledge_items where id=p_knowledge_id for update;
  if not found then raise exception 'knowledge_not_found'; end if;
  if k.status <> 'proposed' then return jsonb_build_object('validated',false,'reason','not_proposed','status',k.status); end if;
  if k.authority not in ('A','B','C') then return jsonb_build_object('validated',false,'reason','authority_requires_review'); end if;
  update public.financial_knowledge_items set status='validated',updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('validated_by','admin','validated_at',now()) where id=k.id;
  return jsonb_build_object('validated',true,'knowledge_id',k.id);
end; $$;
revoke all on function public.lia_admin_validate_financial_knowledge(uuid) from public,anon,authenticated;
grant execute on function public.lia_admin_validate_financial_knowledge(uuid) to service_role;
