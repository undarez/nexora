-- Remove superseded overloaded supervisor memory RPC signatures.
drop function if exists public.lia_orchestration_write_work_memory(uuid,jsonb);
drop function if exists public.lia_orchestration_write_work_memory(uuid,uuid,jsonb);
