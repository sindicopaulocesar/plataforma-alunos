-- =====================================================================
-- Plataforma do Aluno · Formação de Síndicos Profissionais
-- 1) Estrutura do banco, regras de acesso e pastas de arquivos.
-- Cole tudo no Supabase > SQL Editor > New query e clique em Run.
-- Pode ser rodado de novo sem perder dados.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists public.turmas (
  id          text primary key,             -- ex.: 'rj-2027'
  cidade      text not null,
  parceiro    text not null,
  nome        text not null,
  inicio      date,
  formatura   date,
  horario     text,
  ativa       boolean not null default true
);

create table if not exists public.modulos (
  numero  int primary key,                  -- 1 a 6
  romano  text not null,
  titulo  text not null
);

create table if not exists public.aulas (
  numero      int primary key,              -- 1 a 24
  modulo      int not null references public.modulos(numero),
  titulo      text not null,
  docente     text,
  objetivo    text,
  ementa      text[] not null default '{}',
  pratica     text,
  base_legal  text
);

create table if not exists public.matriculas (
  email     text primary key,               -- sempre em minúsculas
  nome      text not null,
  turma_id  text references public.turmas(id),
  papel     text not null default 'aluno' check (papel in ('aluno','professor','parceiro')),
  criado_em timestamptz not null default now()
);

create table if not exists public.perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text not null unique,
  nome      text not null,
  telefone  text,
  atuacao   text,
  papel     text not null default 'aluno' check (papel in ('aluno','professor','parceiro')),
  turma_id  text references public.turmas(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.encontros (
  id        bigint generated always as identity primary key,
  turma_id  text not null references public.turmas(id) on delete cascade,
  data      date,                           -- vazio = a definir
  titulo    text not null,
  tipo      text not null default 'presencial' check (tipo in ('presencial','virtual')),
  aulas     int[] not null default '{}',
  detalhe   text
);

create table if not exists public.materiais (
  id           bigint generated always as identity primary key,
  aula         int not null references public.aulas(numero),
  turma_id     text references public.turmas(id) on delete cascade, -- vazio = todas as turmas
  titulo       text not null,
  caminho      text,                        -- arquivo na pasta "materiais"
  link         text,                        -- ou um link externo
  liberado_em  date not null default current_date,
  criado_em    timestamptz not null default now()
);

create table if not exists public.tarefas (
  id           bigint generated always as identity primary key,
  turma_id     text not null references public.turmas(id) on delete cascade,
  titulo       text not null,
  descricao    text,
  tipo         text not null check (tipo in ('formativa','pi_parte','pi_final','pratica')),
  modulo       int references public.modulos(numero),
  prazo        date,
  aceita_envio boolean not null default true,
  ordem        int not null default 0
);

create table if not exists public.entregas (
  tarefa_id    bigint not null references public.tarefas(id) on delete cascade,
  aluno_id     uuid not null references public.perfis(id) on delete cascade,
  caminho      text not null,
  nome_arquivo text not null,
  enviado_em   timestamptz not null default now(),
  primary key (tarefa_id, aluno_id)
);

create table if not exists public.notas (
  tarefa_id   bigint not null references public.tarefas(id) on delete cascade,
  aluno_id    uuid not null references public.perfis(id) on delete cascade,
  nota        numeric(4,2) check (nota between 0 and 10),
  comentario  text,
  lancada_em  timestamptz not null default now(),
  primary key (tarefa_id, aluno_id)
);

create table if not exists public.presencas (
  encontro_id bigint not null references public.encontros(id) on delete cascade,
  aluno_id    uuid not null references public.perfis(id) on delete cascade,
  status      text not null check (status in ('P','F','R')),  -- presente, falta, reposição
  primary key (encontro_id, aluno_id)
);

create table if not exists public.concluidas (
  aluno_id uuid not null references public.perfis(id) on delete cascade,
  aula     int not null references public.aulas(numero),
  em       timestamptz not null default now(),
  primary key (aluno_id, aula)
);

create table if not exists public.avisos (
  id        bigint generated always as identity primary key,
  turma_id  text references public.turmas(id) on delete cascade, -- vazio = todas
  titulo    text not null,
  texto     text,
  criado_em timestamptz not null default now()
);

create table if not exists public.certificados (
  aluno_id     uuid primary key references public.perfis(id) on delete cascade,
  caminho      text not null,
  enviado_em   timestamptz not null default now()
);

create table if not exists public.mensagens (
  id        bigint generated always as identity primary key,
  aluno_id  uuid not null references public.perfis(id) on delete cascade,
  texto     text not null,
  lida      boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------- funções de apoio ----------
create or replace function public.eh_professor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'professor');
$$;

create or replace function public.minha_turma() returns text
language sql stable security definer set search_path = public as $$
  select turma_id from public.perfis where id = auth.uid();
$$;

-- Só entra quem o professor matriculou. Ao criar a senha, o perfil é montado
-- a partir da matrícula. E-mail fora da lista é recusado.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.matriculas;
begin
  select * into m from public.matriculas where email = lower(new.email);
  if not found then
    raise exception 'EMAIL_NAO_MATRICULADO';
  end if;
  insert into public.perfis (id, email, nome, papel, turma_id)
  values (new.id, lower(new.email), m.nome, m.papel, m.turma_id)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- O aluno pode mudar nome, telefone e atuação, mas não o papel nem a turma.
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_professor() then
    new.papel := old.papel; new.turma_id := old.turma_id; new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists proteger_perfil on public.perfis;
create trigger proteger_perfil before update on public.perfis
  for each row execute function public.proteger_perfil();

-- Ao mudar a matrícula, atualiza o perfil de quem já entrou.
create or replace function public.sincronizar_matricula() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.perfis set nome = new.nome, turma_id = new.turma_id, papel = new.papel
   where email = new.email;
  return new;
end $$;

drop trigger if exists sincronizar_matricula on public.matriculas;
create trigger sincronizar_matricula after update on public.matriculas
  for each row execute function public.sincronizar_matricula();

-- Diz à tela de entrada se o e-mail está matriculado e se já criou senha.
create or replace function public.situacao_email(e text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.perfis where email = lower(e)) then 'tem_senha'
    when exists (select 1 from public.matriculas where email = lower(e)) then 'primeiro_acesso'
    else 'nao_matriculado' end;
$$;
grant execute on function public.situacao_email(text) to anon, authenticated;

-- O professor define uma senha nova para um aluno que esqueceu a dele.
create or replace function public.redefinir_senha(aluno uuid, nova text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.eh_professor() then raise exception 'SOMENTE_PROFESSOR'; end if;
  if length(nova) < 6 then raise exception 'SENHA_CURTA'; end if;
  update auth.users set encrypted_password = extensions.crypt(nova, extensions.gen_salt('bf'))
   where id = aluno;
end $$;
revoke execute on function public.redefinir_senha(uuid, text) from anon;

-- ---------- regras de acesso (cada aluno vê só a sua turma e só os seus dados) ----------
do $$
declare t text;
begin
  foreach t in array array['turmas','modulos','aulas','matriculas','perfis','encontros','materiais',
    'tarefas','entregas','notas','presencas','concluidas','avisos','certificados','mensagens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists professor_tudo on public.%I', t);
    execute format('create policy professor_tudo on public.%I for all to authenticated using (public.eh_professor()) with check (public.eh_professor())', t);
  end loop;
end $$;

drop policy if exists ver_turma on public.turmas;
create policy ver_turma on public.turmas for select to authenticated using (id = public.minha_turma());

drop policy if exists ver_modulos on public.modulos;
create policy ver_modulos on public.modulos for select to authenticated using (true);

drop policy if exists ver_aulas on public.aulas;
create policy ver_aulas on public.aulas for select to authenticated using (true);

drop policy if exists ver_proprio on public.perfis;
create policy ver_proprio on public.perfis for select to authenticated using (id = auth.uid());
drop policy if exists editar_proprio on public.perfis;
create policy editar_proprio on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists ver_encontros on public.encontros;
create policy ver_encontros on public.encontros for select to authenticated using (turma_id = public.minha_turma());

drop policy if exists ver_materiais on public.materiais;
create policy ver_materiais on public.materiais for select to authenticated
  using ((turma_id is null or turma_id = public.minha_turma()) and liberado_em <= current_date);

drop policy if exists ver_tarefas on public.tarefas;
create policy ver_tarefas on public.tarefas for select to authenticated using (turma_id = public.minha_turma());

drop policy if exists ver_avisos on public.avisos;
create policy ver_avisos on public.avisos for select to authenticated
  using (turma_id is null or turma_id = public.minha_turma());

drop policy if exists entregas_proprias on public.entregas;
create policy entregas_proprias on public.entregas for all to authenticated
  using (aluno_id = auth.uid())
  with check (aluno_id = auth.uid() and exists (
    select 1 from public.tarefas t where t.id = tarefa_id and t.turma_id = public.minha_turma() and t.aceita_envio));

drop policy if exists ver_notas on public.notas;
create policy ver_notas on public.notas for select to authenticated using (aluno_id = auth.uid());

drop policy if exists ver_presencas on public.presencas;
create policy ver_presencas on public.presencas for select to authenticated using (aluno_id = auth.uid());

drop policy if exists concluidas_proprias on public.concluidas;
create policy concluidas_proprias on public.concluidas for all to authenticated
  using (aluno_id = auth.uid()) with check (aluno_id = auth.uid());

drop policy if exists ver_certificado on public.certificados;
create policy ver_certificado on public.certificados for select to authenticated using (aluno_id = auth.uid());

drop policy if exists mensagens_proprias on public.mensagens;
create policy mensagens_proprias on public.mensagens for insert to authenticated with check (aluno_id = auth.uid());
drop policy if exists ver_mensagens_proprias on public.mensagens;
create policy ver_mensagens_proprias on public.mensagens for select to authenticated using (aluno_id = auth.uid());

-- ---------- pastas de arquivos (privadas) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('materiais','materiais',false, 52428800),
       ('entregas','entregas',false, 20971520),
       ('certificados','certificados',false, 10485760)
on conflict (id) do nothing;

drop policy if exists arq_professor on storage.objects;
create policy arq_professor on storage.objects for all to authenticated
  using (bucket_id in ('materiais','entregas','certificados') and public.eh_professor())
  with check (bucket_id in ('materiais','entregas','certificados') and public.eh_professor());

-- material: o aluno baixa só o que já foi liberado para a turma dele
drop policy if exists arq_materiais_aluno on storage.objects;
create policy arq_materiais_aluno on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and exists (select 1 from public.materiais m where m.caminho = storage.objects.name));

-- entregas: cada aluno usa só a própria pasta (entregas/<id do aluno>/...)
drop policy if exists arq_entregas_aluno on storage.objects;
create policy arq_entregas_aluno on storage.objects for all to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'entregas' and (storage.foldername(name))[1] = auth.uid()::text);

-- certificado: o aluno baixa só o próprio (certificados/<id do aluno>/...)
drop policy if exists arq_certificado_aluno on storage.objects;
create policy arq_certificado_aluno on storage.objects for select to authenticated
  using (bucket_id = 'certificados' and (storage.foldername(name))[1] = auth.uid()::text);
