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
  aula         int references public.aulas(numero),
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

-- ---------- permissões da API (vale mesmo se o projeto foi criado sem "acesso automático") ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.eh_professor(), public.minha_turma() to authenticated;
grant execute on function public.redefinir_senha(uuid, text) to authenticated;
-- 2) Conteúdo inicial: curso-base (módulos e aulas), as 4 turmas, o calendário e as avaliações da turma do Rio.
-- Rode depois do 01-estrutura.sql. Pode rodar de novo: atualiza sem duplicar.

insert into public.modulos (numero, romano, titulo) values
  (1, 'I', 'Primeiros Passos na Sindicatura'),
  (2, 'II', 'Direito e Governança'),
  (3, 'III', 'Gestão Financeira e Tributária'),
  (4, 'IV', 'Manutenção, Engenharia e Segurança Predial'),
  (5, 'V', 'Convivência e Pessoas'),
  (6, 'VI', 'Inovação, Tecnologia e Carreira')
on conflict (numero) do update set romano=excluded.romano, titulo=excluded.titulo;

insert into public.aulas (numero, modulo, titulo, docente, objetivo, ementa, pratica, base_legal) values
  (1, 1, 'O Síndico e o Condomínio: Papel, Transição e Plano de 90 Dias', 'Prof. Paulo Cesar', 'Compreender a estrutura do condomínio e o papel do síndico, e assumir uma gestão com método, documentando o estado recebido e definindo prioridades.', array['Condomínio edilício: partes exclusivas e comuns, fração ideal; tipos residencial, comercial, misto, de lotes e multipropriedade','Natureza jurídica e órgãos: assembleia, síndico, subsíndico e conselho; CNPJ e representação pelo síndico','Síndico morador e profissional; pessoa física ou jurídica; mandato de até 2 anos, renovável; destituição','As nove competências do art. 1.348 do Código Civil, cada uma traduzida em rotinas reais','O mercado condominial carioca e a postura ética do síndico','Transição de gestão e termo de recebimento: convenção, regimento, atas, contratos, apólice, certificado dos Bombeiros, laudos e autovistoria, manual do edifício, extratos, senhas e acessos','Formalização: registro da ata de eleição, responsável no CNPJ, bancos e certificado digital – DBE, rotinas da Administradora','Vistoria inicial por sistema, com registro fotográfico e relatório aos moradores','Alinhamento com o conselho e apresentação oficial aos moradores','Plano de 90 dias: ganhos rápidos e ações estruturais, priorizados pela matriz GUT (gravidade, urgência, tendência)']::text[], '“Raio-X do condomínio” e checklist de vistoria a partir de fotos de um condomínio real.', 'Código Civil, arts. 1.331 a 1.358-A (destaque para 1.347, 1.348, 1.349 e 1.356) · Lei 4.591/1964 · CPC, art. 75, XI · ABNT NBR 14037'),
  (2, 1, 'Comunicação Condominial e Atendimento ao Morador', 'Prof. Paulo Cesar', 'Estruturar uma comunicação clara, rastreável e que previna conflitos.', array['Comunicação como ferramenta de gestão e de proteção jurídica: o que não está registrado não aconteceu','Canais: mural, circular, e-mail, aplicativo de gestão, grupos e listas de WhatsApp, reuniões presenciais e virtuais','Redação de comunicados: o quê, por quê, quando, impacto e contato; tom neutro e objetivo','O que nunca publicar: lista nominal de inadimplentes, dados pessoais, acusações sem apuração','Política de atendimento: protocolo, prazos de resposta e registro de ocorrências','Hospitalidade aplicada ao condomínio (inspirada no método Disney): portaria e zeladoria como linha de frente','Comunicação em crise: falta d''água, vazamento, acidente, obra emergencial','Relatório mensal de gestão para conselho e moradores']::text[], 'Reescrita de três comunicados reais problemáticos e simulação de atendimento a um morador exaltado.', 'Lei 13.709/2018 (LGPD) · Código Civil, art. 186 (dano moral por exposição indevida)'),
  (3, 1, 'Implantação de Condomínios: da Entrega da Construtora à Primeira Gestão', 'Prof. Paulo Cesar', 'Compreender o processo de implantação de um condomínio, desde a fase de constituição e entrega do empreendimento até a estruturação da primeira gestão, desenvolvendo competências para organizar a operação, receber áreas comuns e estabelecer os procedimentos administrativos, financeiros e operacionais iniciais.', array['O ciclo de vida de um empreendimento imobiliário e o nascimento do condomínio','Constituição do condomínio edilício e documentação inicial','Assembleia de instalação: convocação, pauta, deliberações e eleição do primeiro síndico','Convenção condominial e regimento interno: elaboração, análise e aplicação','CNPJ, inscrição municipal, abertura de conta bancária e formalização administrativa','Recebimento das áreas comuns: procedimentos, inspeções e documentação','Relação com incorporadora, construtora e empresas responsáveis pelo empreendimento','Memorial descritivo, projetos, manuais de uso e operação e garantias','Identificação de vícios construtivos e registro de inconformidades','Contratação de administradora, fornecedores e serviços essenciais','Estruturação do primeiro orçamento e previsão das despesas iniciais','Dimensionamento de equipes, portaria, limpeza, segurança e manutenção','Implantação de controles administrativos e operacionais','Planejamento dos primeiros 90 dias de funcionamento']::text[], 'Simulação de implantação de um condomínio recém-entregue, com análise de documentos, elaboração de checklist de recebimento e identificação de pendências junto à construtora.', 'Código Civil, arts. 1.331 a 1.358-A · Lei 4.591/1964 · Código de Defesa do Consumidor · ABNT NBR 14037 · ABNT NBR 15575'),
  (4, 1, 'Gestão de Contratos e Fornecedores: Como Contratar, Negociar e Fiscalizar', 'Profissional especialista em gestão de contratos ou administração condominial', 'Capacitar o síndico para estruturar processos de contratação, avaliar fornecedores, negociar condições comerciais e fiscalizar a execução dos serviços, reduzindo riscos financeiros, operacionais e jurídicos para o condomínio.', array['O processo de contratação no ambiente condominial','Identificação da necessidade e elaboração de escopo técnico','Solicitação e comparação de propostas comerciais','Critérios de seleção: preço, qualidade, experiência, capacidade técnica e reputação','Análise de documentação cadastral, fiscal, trabalhista e técnica','Negociação comercial e construção de condições contratuais','Elementos essenciais de um contrato de prestação de serviços','Prazos, reajustes, garantias, responsabilidades e penalidades','Gestão e fiscalização de contratos','Indicadores de desempenho e avaliação de fornecedores','Gestão de aditivos, renovações, rescisões e encerramento contratual','Identificação de riscos e prevenção de passivos','Relação entre síndico, administradora, conselho e prestadores de serviços']::text[], 'Análise comparativa de três propostas comerciais para contratação de um serviço condominial, com avaliação de riscos e simulação de negociação.', 'Código Civil, arts. 421, 421-A, 422, 593 a 609 e 618 · Lei 6.019/1974 · Lei 13.429/2017 · Código de Defesa do Consumidor, quando aplicável'),
  (5, 2, 'Direito Condominial Essencial e Responsabilidade do Síndico', 'Advogado condominialista (a confirmar)', 'Interpretar as normas que regem o condomínio e conhecer os limites da responsabilidade pessoal do síndico.', array['Fontes: Constituição, Código Civil, Lei 4.591/1964 (no que não conflita), CPC e normas municipais e estaduais','Hierarquia: lei, convenção, regimento interno e deliberações de assembleia; cláusulas nulas','Convenção: conteúdo obrigatório, aprovação por 2/3, registro no Registro de Imóveis e oponibilidade a terceiros','Regimento interno: função, limites e quórum de alteração definido na convenção','Direitos e deveres dos condôminos; rateio por fração ideal ou critério da convenção','Proprietário, possuidor e locatário: quem paga, quem vota, quem responde','Cláusulas desatualizadas mais comuns: proibição genérica de animais, multa moratória acima de 2%, sanções sem direito de defesa','Radar legislativo: proposta de reforma do Código Civil (PL 4/2025) e seus reflexos no condomínio','Responsabilidade civil do síndico: ação ou omissão, culpa, dano e nexo; quando responde o condomínio e quando responde o síndico pessoalmente','Casos típicos: queda de revestimento, acidentes em áreas comuns, falta de certificado dos Bombeiros ou de autovistoria e danos por falta de manutenção; furtos na garagem só geram responsabilidade com previsão na convenção','Responsabilidade criminal: apropriação indébita, INSS descontado e não repassado, falsidade ideológica e omissão de quem tinha o dever de agir','Como se proteger: atas, laudos e registros em dia, contrato bem redigido, seguro de responsabilidade civil do síndico e prestação de contas final']::text[], 'Análise de uma convenção real anonimizada, apontando cinco cláusulas inválidas ou desatualizadas.', 'Código Civil, arts. 1.332 a 1.336 e 1.351 · Lei 4.591/1964, art. 24, § 4º · Enunciado 248 da III Jornada de Direito Civil (CJF) · Código Civil, arts. 186, 187 e 927 · Código Penal, arts. 13, § 2º, 168, 168-A e 299'),
  (6, 2, 'Governança: Conselho, Administradora e Plano Diretor', 'Prof. Paulo Cesar e Fábio (Centrimóveis)', 'Definir quem faz o quê na gestão, controlar os serviços contratados e planejar além do mandato.', array['Síndico decide e responde; conselho fiscaliza e emite parecer sobre as contas; administradora executa funções delegadas, sem transferir a responsabilidade do síndico','Matriz RACI da gestão condominial','Contrato com a administradora: escopo, prazos, penalidades, rescisão e propriedade de dados e documentos;','Escolha e avaliação da administradora: concorrência, referências e indicadores (fechamento da pasta, conciliação, inadimplência, tempo de resposta)','Conflitos de interesse: comissões e indicação de fornecedores','Plano diretor de 2 a 5 anos: por que protege o síndico e valoriza o patrimônio','Diagnóstico e ferramentas: pesquisa com moradores, análise SWOT, matriz GUT e objetivos SMART','Eixos do plano (manutenção, fundo de obras, segurança, sustentabilidade, convivência) e cronograma plurianual ligado ao orçamento, com aprovação em assembleia']::text[], 'Avaliação comparativa de duas propostas de administradoras e esboço de um plano diretor.', 'Código Civil, arts. 1.348, § 2º, e 1.356'),
  (7, 2, 'Assembleias: Convocação, Quóruns, Formato Eletrônico e Ata', 'Prof. Paulo Cesar e Dr. Raphael Caldas', 'Planejar e conduzir assembleias produtivas e juridicamente válidas, com o quórum certo para cada matéria.', array['AGO anual e AGE: matérias, quem convoca e prazos da convenção','Convocação de todos sob pena de nulidade; edital com pauta específica; "assuntos gerais" não deliberam','Preparação: documentos prévios, orçamentos comparativos, lista de presença, procurações e conferência de inadimplentes','Quórum de instalação e de deliberação; quóruns legais por matéria e quóruns especiais da convenção','Sessão permanente: até 60 dias por continuação e 90 dias no total','Assembleia eletrônica e híbrida: requisitos, plataformas, identificação de votantes e guarda das evidências','Condução: presidente e secretário, tempo de fala, votação por fração ideal ou por unidade e manejo de tumulto','Ata: elementos essenciais, redação imparcial, envio e registro; vícios que levam à anulação judicial','Estratégias para aumentar a participação: horário, formato híbrido e pré-assembleia informativa']::text[], 'Edital e pauta de uma AGO, quiz de quóruns com 15 situações e redação de ata.', 'Código Civil, arts. 1.335, III, 1.341 a 1.343, 1.349 e 1.350 a 1.355 (incluindo o 1.354-A) · Lei 14.309/2022 · Lei 14.405/2022'),
  (8, 2, 'Notificações, Multas e o Condômino Antissocial', 'Dr. Raphael Caldas', 'Aplicar sanções proporcionais, com direito de defesa e segurança jurídica.', array['Poder disciplinar do condomínio e seus limites na convenção e no regimento','Gradação: orientação, advertência escrita, multa e multa por reiteração','Multa por descumprimento de dever: até 5 vezes a contribuição mensal','Reiterado descumprimento: até 5 vezes, por deliberação de 3/4 dos condôminos restantes','Comportamento antissocial: até 10 vezes a contribuição, até nova deliberação da assembleia','Direito de defesa prévio como condição de validade da sanção','Processo: registro da ocorrência, provas, notificação com prazo de defesa, decisão fundamentada, recurso e lançamento','Infração cometida por inquilino ou visitante: quem responde perante o condomínio','Exclusão do condômino antissocial: debate doutrinário, jurisprudência e via judicial','Erros que anulam multas na Justiça']::text[], 'Instrução completa de um processo de multa, do registro à decisão.', 'Código Civil, arts. 1.336, § 2º, e 1.337 · Enunciados 92 e 508 das Jornadas de Direito Civil (CJF)'),
  (9, 3, 'Previsão Orçamentária e Fundo de Reserva', 'Prof. Paulo Cesar e Fábio (Centrimóveis)', 'Elaborar um orçamento realista, defensável em assembleia e que evite chamadas extras ao longo do ano.', array['Orçamento como instrumento de gestão e matéria obrigatória da AGO','Levantamento histórico de 12 a 24 meses e plano de contas: pessoal, encargos, consumo, contratos, conservação, administrativas, seguros e fundos','Projeção: dissídio da categoria, reajustes contratuais por índice (IPCA, IGP-M) e tarifas de água, energia e gás','Sazonalidade: 13º salário, férias, dissídio, renovação de seguro, laudos e autovistoria','Rateio por fração ideal ou critério da convenção; despesas ordinárias e extraordinárias e quem as paga na locação','Fundo de reserva e fundo de obras: previsão na convenção, finalidade, uso e aplicação financeira','Provisão para inadimplência','Apresentação em assembleia: comparativo orçado versus realizado, justificativa por linha e cenários']::text[], 'Construção da previsão orçamentária anual de um condomínio-caso em planilha.', 'Código Civil, arts. 1.336, I, e 1.350 · Lei 8.245/1991, arts. 22 e 23 (despesas do locador e do locatário)'),
  (10, 3, 'Prestação de Contas, Transparência e Auditoria', 'Prof. Paulo Cesar e Fábio (Centrimóveis)', 'Prestar contas de forma clara, completa e à prova de questionamentos.', array['Dever de prestar contas anualmente e sempre que exigido; parecer do conselho fiscal','Contabilidade condominial: regime de caixa e de competência','Pasta mensal: balancete, extratos, conciliação, comprovantes, notas fiscais, folha e guias','Controles internos: segregação de funções, dupla aprovação de pagamentos, alçadas e três orçamentos','Relatórios visuais: orçado versus realizado, indicadores e gráficos simples','Auditoria interna e independente: quando contratar e o que esperar','Acesso dos condôminos aos documentos e resposta a questionamentos','Sinais de alerta de fraude: despesas fracionadas, fornecedor recorrente sem concorrência, pagamentos sem nota']::text[], 'Análise de uma pasta de prestação de contas com inconsistências inseridas de propósito.', 'Código Civil, arts. 1.348, VIII, e 1.356'),
  (11, 3, 'Inadimplência: Prevenção, Cobrança e Recuperação de Crédito', 'Dr. Raphael Caldas', 'Reduzir a inadimplência com uma régua de cobrança legal, humana e eficiente.', array['Impacto da inadimplência no caixa e no rateio entre adimplentes','Encargos legais: juros convencionados ou 1% ao mês, multa de até 2% e correção monetária','Prevenção: boleto claro, Pix, lembretes e atendimento ao devedor','Régua de cobrança: administrativa, extrajudicial, protesto em cartório e acordos com confissão de dívida','Cobrança judicial: execução de título extrajudicial, penhora e exceção do bem de família','Obrigação propter rem: responsabilidade do adquirente pelos débitos da unidade','Prescrição de 5 anos para cobrança de cotas','Garantidoras de receita: vantagens, custos e cláusulas de atenção','Limites: proibido expor o devedor ou bloquear acesso a áreas comuns e serviços essenciais; o inadimplente não vota']::text[], 'Montagem da régua de cobrança e role-play de negociação de acordo.', 'Código Civil, arts. 206, § 5º, I, 1.335, III, 1.336, § 1º, e 1.345 · CPC, art. 784, X · Lei 8.009/1990, art. 3º, IV'),
  (12, 3, 'Folha, Tributos, Obrigações Acessórias e Reforma Tributária', 'Contador condominial (a confirmar)', 'Cumprir as obrigações fiscais e trabalhistas do condomínio e entender os efeitos da Reforma Tributária.', array['Condomínio empregador: registro, eSocial, FGTS Digital, contribuições previdenciárias e convenção coletiva da categoria no Rio de Janeiro','Retenções na contratação de serviços: INSS de 11% na cessão de mão de obra, retenções federais conforme o tipo de serviço e ISS','ISS no município do Rio de Janeiro: quando a lei municipal exige retenção pelo condomínio e como conferir a Nota Carioca do prestador','Obrigações acessórias: eSocial, EFD-Reinf e DCTFWeb; prazos e multas','Remuneração ou isenção de cota do síndico: tratamento previdenciário e de imposto de renda','Receitas próprias do condomínio (antenas, fachada, locação de espaços) e seus reflexos fiscais','Reforma Tributária: o condomínio edilício, como regra, não é contribuinte de IBS e CBS; pode optar pelo regime regular, que tributa todas as cotas','Teste dos 80%: se as cotas ficarem abaixo de 80% da receita total, há incidência sobre as operações com terceiros','Transição de 2026 a 2033 e o efeito nos preços dos prestadores contratados']::text[], 'Conferência de notas de prestadores e cálculo do teste dos 80%.', 'Lei 8.212/1991, art. 31 · EC 132/2023 · LC 214/2025 e regulamentação de 2026 (análise)'),
  (13, 4, 'Plano de Manutenção, Inspeção Predial e Autovistoria', 'Prof. Paulo Cesar e engenheiro civil', 'Implantar um sistema de manutenção que preserve o patrimônio e mantenha a autovistoria em dia.', array['Conservação das partes comuns como dever legal do síndico','Manutenção preventiva, corretiva e preditiva; rotineira e planejada','NBR 5674: sistema de gestão da manutenção, programa, responsáveis e registros','NBR 14037 e garantias da construtora: como a falta de manutenção faz o condomínio perder garantias','NBR 16747: inspeção predial, classificação de anomalias e falhas e grau de risco','Autovistoria predial obrigatória no Rio de Janeiro: vistoria técnica a cada 5 anos, laudo de engenheiro ou arquiteto com ART ou RRT e comunicação à Prefeitura','Responsabilidade do condomínio, representado pelo síndico; edificações dispensadas e o que acontece quando o laudo aponta pendências','Diagnóstico por sistema: estrutura, fachada, cobertura, impermeabilização, hidráulica, elétrica, bombas, portões, CFTV e lazer','Cronograma anual por item e frequência, orçamento e responsáveis (equipe própria, contratos, terceiros)','Evidências que protegem o síndico: ordens de serviço, relatórios, fotos e sistemas de gestão de ativos']::text[], 'Cronograma anual de manutenção de um condomínio-caso, com a data da próxima autovistoria.', 'Código Civil, art. 1.348, V · Lei Complementar Municipal 126/2013, Lei Estadual 6.400/2013 e Decreto Municipal 37.426/2013 (autovistoria) · ABNT NBR 5674, NBR 14037, NBR 15575 e NBR 16747'),
  (14, 4, 'Obras e Reformas em Áreas Comuns e Unidades (NBR 16280)', 'Engenheiro civil (a confirmar)', 'Autorizar, contratar e fiscalizar obras com segurança técnica e jurídica.', array['Obras necessárias, úteis e voluptuárias: quórum, urgência e limites de atuação do síndico','Reformas em unidades pela NBR 16280: plano de reforma, responsável técnico com ART ou RRT, análise e autorização','O que o morador não pode fazer: alterar fachada, estrutura, prumadas ou sobrecarregar lajes','Obras em áreas comuns: escopo, projeto, memorial descritivo, concorrência com equalização de propostas','Contrato de obra: preço, prazo, medições, retenção técnica, garantia e seguro de obra','Fiscalização: engenheiro fiscal, diário de obra e controle de aditivos','Segurança do trabalho: NR-18 e NR-35 (balancins, cadeirinhas, trabalho em altura)','Licenças da Prefeitura do Rio quando exigidas e comunicação com moradores durante a obra','Recebimento: vistoria final, termo de recebimento e avaliação pós-obra']::text[], 'Análise de um plano de reforma e equalização de três propostas para obra de fachada.', 'Código Civil, arts. 1.336, III, e 1.341 · ABNT NBR 16280 · NR-18 e NR-35 · Código de Obras e Edificações Simplificado do Rio de Janeiro – COES (Lei Complementar 198/2019)'),
  (15, 4, 'Sistemas Críticos e Licenças: Bombeiros, Elevadores, SPDA, Gás e Recarga', 'Engenheiro de segurança, eletricista ou engenheiro civil (parceiros)', 'Manter o edifício regular e seguro nos sistemas que mais geram responsabilidade.', array['Certificado de Aprovação do Corpo de Bombeiros do Rio (CBMERJ): exigências do COSCIP, Notas Técnicas e trâmite digital','Sistemas de segurança: extintores, hidrantes, alarme, iluminação de emergência e portas corta-fogo; brigada, plano de emergência e simulados','Elevadores: contrato de manutenção com empresa habilitada, exigências municipais e modernização','SPDA (para-raios): inspeção e laudo periódico','Gás: estanqueidade e laudos; elétrica: quadros, sobrecarga e laudo','Água: limpeza periódica de reservatórios e potabilidade; bombas, geradores e portões','Recarga de veículos elétricos: estudo de carga, modelos (individual, coletivo, gerenciado), medição, cobrança e deliberação em assembleia','Calendário de laudos, licenças e autovistoria; consequências do vencimento: multas, perda de cobertura e responsabilidade do síndico']::text[], 'Calendário de licenças e análise do pedido de um morador para instalar carregador.', 'COSCIP-RJ (Decreto Estadual 42/2018) e Notas Técnicas do CBMERJ · Lei 13.425/2017 · ABNT NBR 5410, NBR 5419 e NBR 17019'),
  (16, 4, 'Seguro Condominial e Gestão de Sinistros', 'Corretor de seguros (a confirmar)', 'Contratar a cobertura adequada e conduzir sinistros com eficiência.', array['Seguro obrigatório de toda a edificação contra incêndio ou destruição total ou parcial','Coberturas: básica, danos elétricos, vendaval, alagamento, vidros, roubo, equipamentos, responsabilidade civil do condomínio e do síndico','Seguro de vida de funcionários quando exigido pela convenção coletiva','Valor em risco, avaliação do imóvel, subseguro e cláusula de rateio','Exclusões, franquias e leitura das condições gerais','Contratação com corretor: cotações, comparação e vigência alinhada ao orçamento','Sinistro: aviso imediato, preservação de evidências, documentação e acompanhamento da regulação','Danos em unidades e em áreas comuns: quem aciona qual apólice','Responsabilidade do síndico por ausência de seguro ou subseguro']::text[], 'Comparação de duas apólices reais e simulação de aviso de sinistro.', 'Código Civil, art. 1.346 · Lei 4.591/1964, art. 13'),
  (17, 5, 'Conflitos, Mediação e Problemas do Dia a Dia', 'Mediador e advogado (a confirmar)', 'Prevenir e mediar conflitos e resolver as reclamações mais frequentes.', array['Natureza e escalada dos conflitos condominiais; o valor da intervenção precoce','Negociação baseada em interesses (método Harvard) e Comunicação Não Violenta','Mediação: o síndico como facilitador, o mediador externo, câmaras privadas e CEJUSC do TJRJ','Quando o conflito é com o próprio síndico: oposição organizada, grupos de mensagens e ataques pessoais','Animais: o STJ veda a proibição genérica; regras razoáveis de circulação, higiene e segurança','Crianças e áreas de lazer; barulho, horários de silêncio e de obras, festas','Vagas de garagem e locação por temporada pelo Airbnb e outras plataformas','Vazamentos entre unidades, fumaça, odores, mudanças e entregas','Fluxo padrão: reclamação registrada, verificação, orientação, mediação, notificação e multa']::text[], 'Role-play de mediação de um conflito por infiltração entre unidades.', 'Lei 13.140/2015 · CPC, arts. 3º e 165 a 175 · Código Civil, arts. 1.277, 1.331, § 1º, e 1.336, IV · Lei 8.245/1991, art. 48 · Lei 8.069/1990 (ECA) · STJ, REsp 1.783.076/DF e REsp 1.819.075/RS · ABNT NBR 10151 e NBR 10152'),
  (18, 5, 'Gestão de Pessoas: Equipe Própria, Terceirização, Trabalhista e NR-01', 'Advogado trabalhista (Haganá)', 'Liderar equipes e contratar serviços reduzindo o passivo trabalhista.', array['Funções típicas: zelador, porteiro, faxineiro, manobrista e folguista','Jornada e escalas (inclusive 12x36), horas extras, adicional noturno e acúmulo de função','Convenção coletiva da categoria no Rio de Janeiro: piso, benefícios e data-base','Admissão, integração, avaliação, advertência, suspensão e justa causa, sempre documentadas','Terceirização: responsabilidade subsidiária do condomínio e fiscalização mensal de FGTS e INSS da contratada','Equipe própria, terceirizada ou portaria remota: custo, controle e risco','Saúde e segurança: NR-01 (gerenciamento de riscos, incluindo psicossociais), PCMSO e EPIs','Prevenção de assédio moral e sexual e canal de denúncias','Liderança no dia a dia: rotinas, metas, feedback e treinamento']::text[], 'Comparação de custo e risco de três modelos de portaria.', 'CLT · Lei 6.019/1974, com alterações das Leis 13.429/2017 e 13.467/2017 · Súmula 331 do TST · NR-01, NR-06 e NR-07'),
  (19, 5, 'Novas Formas de Moradia: Airbnb, Locação por Temporada e Condomínios de Uso Misto', 'Advogado condominialista ou especialista em mercado imobiliário', 'Analisar as transformações nas formas de ocupação e utilização dos empreendimentos imobiliários, compreendendo os desafios jurídicos, operacionais e administrativos decorrentes da locação por temporada, das plataformas digitais e dos condomínios de uso misto.', array['Transformações no mercado imobiliário e nas formas de moradia','Locação residencial tradicional e locação por temporada','Conceitos e características da hospedagem por plataformas digitais','Airbnb e outras plataformas de locação','Diferenças entre locação por temporada e atividade de hospedagem','Convenção condominial e limitações ao uso das unidades','Decisões judiciais sobre locação por plataformas digitais','Segurança, controle de acesso e identificação de ocupantes','Responsabilidade do proprietário e do ocupante','Impactos na rotina, segurança e convivência condominial','Condomínios residenciais, comerciais e de uso misto','Coliving, multipropriedade e novas modalidades de ocupação','Desafios administrativos e operacionais das novas formas de moradia','Estratégias de regulamentação e gestão das novas modalidades de utilização']::text[], 'Estudo de casos envolvendo locação por temporada, análise de convenções condominiais e construção de procedimentos para controle de acesso e ocupação das unidades.', 'Código Civil, arts. 1.331 a 1.358-A · Lei 8.245/1991 (Lei do Inquilinato), especialmente arts. 48 a 50 · Lei 13.777/2018 (Multipropriedade) · legislação e jurisprudência aplicáveis'),
  (20, 5, 'Acessibilidade, Inclusão e Envelhecimento nos Condomínios', 'Especialista em acessibilidade e inclusão ou profissional com experiência em arquitetura e urbanismo', 'Compreender os princípios de acessibilidade e inclusão no ambiente condominial, identificando barreiras físicas, comunicacionais e atitudinais e desenvolvendo ações para promover segurança, autonomia e qualidade de vida aos usuários dos espaços comuns.', array['Conceitos de acessibilidade, inclusão e desenho universal','Direitos das pessoas com deficiência e mobilidade reduzida','Acessibilidade nas áreas comuns e rotas acessíveis','Rampas, elevadores, corrimãos, sinalização e circulação','Vagas especiais e espaços de uso coletivo','Barreiras arquitetônicas e adaptações necessárias','Acessibilidade em edificações existentes','Envelhecimento populacional e novas demandas habitacionais','Segurança e autonomia das pessoas idosas','Inclusão e atendimento respeitoso aos moradores','Acessibilidade comunicacional e digital','Animais de assistência e questões de convivência','Planejamento de adequações e priorização de intervenções','Responsabilidades do condomínio e gestão de demandas específicas']::text[], 'Realização de um diagnóstico de acessibilidade a partir de imagens e plantas de um condomínio, identificando barreiras e propondo melhorias.', 'Lei 13.146/2015 (Lei Brasileira de Inclusão) · Lei 10.098/2000 · Decreto 5.296/2004 · ABNT NBR 9050 · ABNT NBR 16537'),
  (21, 6, 'Inteligência Artificial para Síndicos', 'Rafael Bernardes', 'Usar inteligência artificial no dia a dia da sindicatura para ganhar tempo e qualidade, com segurança.', array['O que é IA generativa e como funcionam os assistentes de texto, voz e imagem mais usados','Como pedir bem: contexto, papel, tarefa, formato e exemplos; refinar a resposta em etapas','Comunicação: comunicados, circulares e respostas a moradores no tom certo para cada situação','Assembleias: edital, pauta, roteiro de condução e minuta de ata a partir da gravação ou transcrição','Documentos: resumo de convenção, regimento, contratos e apólices; comparação de propostas de fornecedores','Finanças: leitura de planilhas, orçado versus realizado e gráficos para a prestação de contas','Manutenção: cronogramas, checklists e laudos técnicos explicados em linguagem simples','Produtividade e marca pessoal: agenda, e-mails, propostas e conteúdo para redes sociais','Automações e atendimento: assistentes no WhatsApp e integração com aplicativos de gestão','Limites: erros e informações inventadas, conferência da base legal, sigilo, dados pessoais e responsabilidade final do síndico']::text[], 'Oficina: cada aluno produz um comunicado, uma minuta de ata e um comparativo de propostas.', 'Lei 13.709/2018 (LGPD), no uso de dados pessoais em ferramentas de IA'),
  (22, 6, 'Tecnologia, Segurança e LGPD no Condomínio', 'Especialista em tecnologia e LGPD', 'Escolher e contratar tecnologia para o condomínio, tratando dados pessoais dentro da lei.', array['Tecnologia condominial: aplicativos de gestão, portaria remota, controle de acesso (biometria, reconhecimento facial, QR code), CFTV inteligente, medição individualizada e assinatura eletrônica','Como contratar tecnologia: requisitos, teste piloto, contrato, nível de serviço e propriedade dos dados','LGPD: condomínio como controlador; administradora, portaria e fornecedores como operadores','Bases legais para tratar dados de moradores, visitantes e funcionários; biometria como dado sensível','Imagens de CFTV: prazo de guarda, acesso e atendimento a pedidos de moradores e da polícia','Incidentes de segurança: resposta e comunicação à ANPD','Segurança da informação: senhas, backups e retirada de acessos de ex-funcionários e ex-gestores','Documentos mínimos: inventário de dados, aviso de privacidade, política de CFTV e cláusulas com operadores']::text[], 'Mapeamento dos dados pessoais de um condomínio e avaliação de uma proposta de portaria remota.', 'Lei 13.709/2018 (LGPD), arts. 5º, 7º, 11, 37, 46 e 48'),
  (23, 6, 'Carreira do Síndico Profissional: Posicionamento, Precificação e Captação', 'Prof. Paulo Cesar', 'Transformar a formação em carreira, com marca, preço e método comercial.', array['O mercado de sindicatura profissional no Rio de Janeiro: perfis de condomínio, concorrência e nichos (comercial, alto padrão, condomínios-clube da Barra e do Recreio, instalação de condomínios novos)','Formalização como pessoa jurídica: enquadramento, tributação e ISS','Precificação: horas dedicadas, porte, complexidade, visitas, custos fixos e margem; modelos fixo, por unidade e misto','Proposta comercial e contrato de prestação de serviços: escopo, presença, prazos de resposta, reajuste, rescisão e seguro','Captação: networking com construtoras, administradoras e prestadores; indicação de condôminos e conselheiros','Marca pessoal e redes sociais: Instagram, LinkedIn, YouTube e WhatsApp Business, com calendário de conteúdo','Apresentação em assembleia de eleição: pitch de 5 minutos, diferenciais e plano de 90 dias','Gestão de carteira: rotina semanal com vários condomínios, priorização (Matriz de Eisenhower), equipe e sistemas','Ética comercial e sustentabilidade da carreira: conflito de interesses, inteligência emocional e saúde do síndico']::text[], 'Proposta comercial e pitch de eleição de 5 minutos para a turma.', '—'),
  (24, 6, 'Simulação de Assembleia e Encerramento', 'Prof. Paulo Cesar', 'Integrar todos os conteúdos em uma situação real de pressão e consolidar a formação.', array['Simulação completa de assembleia com papéis distribuídos: síndico, presidente, secretário, conselheiros, condôminos a favor e contra, inquilino, advogado e administradora','Pauta integradora: obra de fachada com rateio extra após a autovistoria, multa por comportamento antissocial, instalação de carregadores e prestação de contas questionada','Oratória e condução sob pressão: voz, postura, controle do tempo e resposta a ataques','Devolutiva da banca: acertos, falhas jurídicas e falhas de condução','Entrega do Projeto Integrador, avaliação final, certificação e ingresso na comunidade de egressos']::text[], 'A própria simulação, com todos os alunos em algum papel.', '—')
on conflict (numero) do update set modulo=excluded.modulo, titulo=excluded.titulo, docente=excluded.docente, objetivo=excluded.objetivo, ementa=excluded.ementa, pratica=excluded.pratica, base_legal=excluded.base_legal;

insert into public.turmas (id, cidade, parceiro, nome, inicio, formatura, horario) values
  ('rj-2027','Rio de Janeiro','Centrimóveis','Turma Rio de Janeiro 2027','2027-02-24','2027-06-15','Quartas e quintas, 18h30 às 22h'),
  ('sp-2027','São Paulo','Condohuby','Turma São Paulo 2027',null,null,null),
  ('cwb-2027','Curitiba','Finocrédito','Turma Curitiba 2027',null,null,null),
  ('poa-2027','Porto Alegre','A definir','Turma Porto Alegre 2027',null,null,null)
on conflict (id) do nothing;

-- O professor (coordenação). Troque o e-mail se preferir entrar com outro.
insert into public.matriculas (email, nome, turma_id, papel) values
  ('formacaodesindicos@gmail.com','Prof. Paulo Cesar da Silva',null,'professor')
on conflict (email) do nothing;

-- Calendário e avaliações da turma do Rio (só na primeira vez)
do $$
begin
if not exists (select 1 from public.encontros where turma_id='rj-2027') then
  insert into public.encontros (turma_id, data, titulo, tipo, aulas) values
    ('rj-2027','2027-02-24','Módulo I · 1ª noite · aula inaugural','presencial',array[1,2]::int[]),
    ('rj-2027','2027-02-25','Módulo I · 2ª noite','presencial',array[3,4]::int[]),
    ('rj-2027','2027-03-10','Módulo II · 1ª noite','presencial',array[5,6]::int[]),
    ('rj-2027','2027-03-11','Módulo II · 2ª noite','presencial',array[7,8]::int[]),
    ('rj-2027','2027-03-31','Módulo III · 1ª noite','presencial',array[9,10]::int[]),
    ('rj-2027','2027-04-01','Módulo III · 2ª noite','presencial',array[11,12]::int[]),
    ('rj-2027','2027-04-28','Módulo IV · 1ª noite','presencial',array[13,14]::int[]),
    ('rj-2027','2027-04-29','Módulo IV · 2ª noite','presencial',array[15,16]::int[]),
    ('rj-2027','2027-05-12','Módulo V · 1ª noite','presencial',array[17,18]::int[]),
    ('rj-2027','2027-05-13','Módulo V · 2ª noite','presencial',array[19,20]::int[]),
    ('rj-2027','2027-06-02','Módulo VI · 1ª noite','presencial',array[21,22]::int[]),
    ('rj-2027','2027-06-03','Módulo VI · 2ª noite','presencial',array[23,24]::int[]),
    ('rj-2027',null,'Encontro virtual 1','virtual','{}'::int[]),
    ('rj-2027',null,'Encontro virtual 2','virtual','{}'::int[]),
    ('rj-2027',null,'Encontro virtual 3','virtual','{}'::int[]);
  insert into public.tarefas (turma_id, titulo, descricao, tipo, modulo, prazo, aceita_envio, ordem) values
    ('rj-2027','Avaliação formativa · Módulo I','Questões respondidas pelo celular ao final do encontro.','formativa',1,'2027-02-25',false,1),
    ('rj-2027','Avaliação formativa · Módulo II','Questões respondidas pelo celular ao final do encontro.','formativa',2,'2027-03-11',false,2),
    ('rj-2027','Avaliação formativa · Módulo III','Questões respondidas pelo celular ao final do encontro.','formativa',3,'2027-04-01',false,3),
    ('rj-2027','Avaliação formativa · Módulo IV','Questões respondidas pelo celular ao final do encontro.','formativa',4,'2027-04-29',false,4),
    ('rj-2027','Avaliação formativa · Módulo V','Questões respondidas pelo celular ao final do encontro.','formativa',5,'2027-05-13',false,5),
    ('rj-2027','Avaliação formativa · Módulo VI','Questões respondidas pelo celular ao final do encontro.','formativa',6,'2027-06-03',false,6),
    ('rj-2027','Projeto Integrador · Parte 1','Diagnóstico, vistoria e plano de 90 dias','pi_parte',1,'2027-03-09',true,7),
    ('rj-2027','Projeto Integrador · Parte 2','Calendário de assembleias, plano diretor resumido e fluxo de penalidades','pi_parte',2,'2027-03-30',true,8),
    ('rj-2027','Projeto Integrador · Parte 3','Previsão orçamentária e régua de cobrança','pi_parte',3,'2027-04-27',true,9),
    ('rj-2027','Projeto Integrador · Parte 4','Plano de manutenção, autovistoria, licenças e seguro','pi_parte',4,'2027-05-11',true,10),
    ('rj-2027','Projeto Integrador · Parte 5','Regras de convivência e fluxo de mediação','pi_parte',5,'2027-06-01',true,11),
    ('rj-2027','Projeto Integrador · Versão final','Plano de Gestão de 12 meses consolidado, com IA e tecnologia, LGPD e proposta comercial.','pi_final',6,'2027-06-08',true,12),
    ('rj-2027','Simulação de assembleia','Participação e desempenho na simulação do último encontro.','pratica',6,'2027-06-03',false,13);
  insert into public.avisos (turma_id, titulo, texto) values
    ('rj-2027','Bem-vindo à Formação de Síndicos Profissionais','A aula inaugural é em 24/02/2027, às 18h30. Confira a agenda e os materiais do Módulo I.');
end if;
end $$;
