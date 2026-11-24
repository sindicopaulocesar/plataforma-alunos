-- 10) Materiais liberados aula a aula, 7 dias antes do encontro da aula na turma do aluno.
-- Turma sem data definida: os materiais ficam fechados até a data ser cadastrada. Pode rodar mais de uma vez.

create or replace function public.material_liberado(p_aula int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.encontros e
     where e.turma_id = public.minha_turma()
       and e.data is not null
       and p_aula = any(e.aulas)
       and e.data - 7 <= (now() at time zone 'America/Sao_Paulo')::date
  );
$$;
grant execute on function public.material_liberado(int) to authenticated;

drop policy if exists ver_materiais on public.materiais;
create policy ver_materiais on public.materiais for select to authenticated
  using ((turma_id is null or turma_id = public.minha_turma()) and public.material_liberado(aula));

select 'Materiais: liberação 7 dias antes de cada encontro' as resultado;
