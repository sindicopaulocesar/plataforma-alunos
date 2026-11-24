-- 8) Código da noite: o professor mostra um código de 4 números no encontro e o aluno
-- marca a própria presença digitando o código na plataforma. Pode rodar mais de uma vez.

create table if not exists public.codigos_presenca (
  encontro_id bigint primary key references public.encontros(id) on delete cascade,
  codigo      text not null,
  criado_em   timestamptz not null default now()
);
alter table public.codigos_presenca enable row level security;
drop policy if exists professor_tudo on public.codigos_presenca;
create policy professor_tudo on public.codigos_presenca for all to authenticated
  using (public.eh_professor()) with check (public.eh_professor());
grant select, insert, update, delete on public.codigos_presenca to authenticated;

-- Limite de tentativas por aluno e por dia (evita chutar códigos)
create table if not exists public.tentativas_codigo (
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  dia      date not null,
  n        int  not null default 0,
  primary key (aluno_id, dia)
);
alter table public.tentativas_codigo enable row level security;

-- Responde 'OK:<encontro>' ou 'ERRO:<motivo>' (sem erro de banco, para o contador de tentativas valer)
drop function if exists public.marcar_presenca(text);
create function public.marcar_presenca(p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_n int;
  v_id bigint;
  v_titulo text;
begin
  if auth.uid() is null then return 'ERRO:SEM_LOGIN'; end if;
  select n into v_n from public.tentativas_codigo where aluno_id = auth.uid() and dia = agora::date;
  if coalesce(v_n, 0) >= 10 then return 'ERRO:MUITAS_TENTATIVAS'; end if;
  if agora::time < time '17:30' or agora::time > time '23:30' then return 'ERRO:FORA_DO_HORARIO'; end if;
  select e.id, e.titulo into v_id, v_titulo
    from public.encontros e join public.codigos_presenca c on c.encontro_id = e.id
   where e.turma_id = public.minha_turma() and e.data = agora::date and c.codigo = trim(p_codigo)
   limit 1;
  if v_id is null then
    insert into public.tentativas_codigo (aluno_id, dia, n) values (auth.uid(), agora::date, 1)
      on conflict (aluno_id, dia) do update set n = public.tentativas_codigo.n + 1;
    return 'ERRO:CODIGO_INVALIDO';
  end if;
  insert into public.presencas (encontro_id, aluno_id, status) values (v_id, auth.uid(), 'P')
    on conflict (encontro_id, aluno_id) do update set status = 'P';
  return 'OK:' || v_titulo;
end $$;
revoke execute on function public.marcar_presenca(text) from public, anon;
grant execute on function public.marcar_presenca(text) to authenticated;

select 'Código da noite instalado' as resultado;
