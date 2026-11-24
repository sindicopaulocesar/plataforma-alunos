-- 9) Presença com QR Code: o código de 4 números muda a cada 40 segundos (o print que circular
-- no WhatsApp perde a validade em 2 minutos). Inclui o ajuste 08. Pode rodar mais de uma vez.

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

-- Código de 4 números do "intervalo" atual (muda a cada 40 segundos), calculado a partir da chave do encontro
create or replace function public.codigo_rotativo(p_chave text, p_slot bigint) returns text
language sql immutable as $$
  select lpad(((('x' || substr(encode(sha256(convert_to(p_chave || ':' || p_slot, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint) % 10000)::text, 4, '0');
$$;
revoke execute on function public.codigo_rotativo(text, bigint) from public, anon, authenticated;

-- Só o professor vê o código atual (para o telão). Responde 'CODIGO|segundos que faltam'
create or replace function public.codigo_atual(p_encontro bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_chave text;
  v_ep numeric := extract(epoch from clock_timestamp());
  v_slot bigint := floor(v_ep / 40);
begin
  if not public.eh_professor() then return 'ERRO:SEM_PROFESSOR'; end if;
  select codigo into v_chave from public.codigos_presenca where encontro_id = p_encontro;
  if v_chave is null then return 'ERRO:SEM_CODIGO'; end if;
  return public.codigo_rotativo(v_chave, v_slot) || '|' || ceil((v_slot + 1) * 40 - v_ep)::int;
end $$;
revoke execute on function public.codigo_atual(bigint) from public, anon;
grant execute on function public.codigo_atual(bigint) to authenticated;

-- O aluno marca a presença. Aceita o código atual e os dois anteriores (até 2 minutos).
-- Responde 'OK:<encontro>' ou 'ERRO:<motivo>' (sem erro de banco, para o contador de tentativas valer)
drop function if exists public.marcar_presenca(text);
create function public.marcar_presenca(p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  agora timestamp := (now() at time zone 'America/Sao_Paulo');
  v_slot bigint := floor(extract(epoch from clock_timestamp()) / 40);
  v_cod text := trim(p_codigo);
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
   where e.turma_id = public.minha_turma() and e.data = agora::date
     and v_cod in (public.codigo_rotativo(c.codigo, v_slot), public.codigo_rotativo(c.codigo, v_slot - 1), public.codigo_rotativo(c.codigo, v_slot - 2))
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

select 'Presença com QR Code instalada' as resultado;
