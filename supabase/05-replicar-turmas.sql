-- 5) Replica o curso do Rio para São Paulo, Curitiba e Porto Alegre: mesmas 24 aulas, agenda, avaliações e atividades.
-- Já inclui o 04 (atividades por aula). As novas turmas ficam SEM DATAS: o professor preenche em Agenda e tarefas.
-- Pode rodar mais de uma vez: só copia para a turma que ainda não tem agenda.
alter table public.tarefas add column if not exists aula int references public.aulas(numero);

insert into public.tarefas (turma_id, titulo, descricao, tipo, modulo, aula, prazo, aceita_envio, ordem)
select v.* from (values
  ('rj-2027', 'Atividade da Aula 1', 'Atividade prática da aula “O Síndico e o Condomínio: Papel, Transição e Plano de 90 Dias”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 1, 1, date '2027-03-03', true, 101),
  ('rj-2027', 'Atividade da Aula 2', 'Atividade prática da aula “Comunicação Condominial e Atendimento ao Morador”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 1, 2, date '2027-03-03', true, 102),
  ('rj-2027', 'Atividade da Aula 3', 'Atividade prática da aula “Implantação de Condomínios: da Entrega da Construtora à Primeira Gestão”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 1, 3, date '2027-03-04', true, 103),
  ('rj-2027', 'Atividade da Aula 4', 'Atividade prática da aula “Gestão de Contratos e Fornecedores: Como Contratar, Negociar e Fiscalizar”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 1, 4, date '2027-03-04', true, 104),
  ('rj-2027', 'Atividade da Aula 5', 'Atividade prática da aula “Direito Condominial Essencial e Responsabilidade do Síndico”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 2, 5, date '2027-03-17', true, 105),
  ('rj-2027', 'Atividade da Aula 6', 'Atividade prática da aula “Governança: Conselho, Administradora e Plano Diretor”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 2, 6, date '2027-03-17', true, 106),
  ('rj-2027', 'Atividade da Aula 7', 'Atividade prática da aula “Assembleias: Convocação, Quóruns, Formato Eletrônico e Ata”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 2, 7, date '2027-03-18', true, 107),
  ('rj-2027', 'Atividade da Aula 8', 'Atividade prática da aula “Notificações, Multas e o Condômino Antissocial”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 2, 8, date '2027-03-18', true, 108),
  ('rj-2027', 'Atividade da Aula 9', 'Atividade prática da aula “Previsão Orçamentária e Fundo de Reserva”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 3, 9, date '2027-04-07', true, 109),
  ('rj-2027', 'Atividade da Aula 10', 'Atividade prática da aula “Prestação de Contas, Transparência e Auditoria”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 3, 10, date '2027-04-07', true, 110),
  ('rj-2027', 'Atividade da Aula 11', 'Atividade prática da aula “Inadimplência: Prevenção, Cobrança e Recuperação de Crédito”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 3, 11, date '2027-04-08', true, 111),
  ('rj-2027', 'Atividade da Aula 12', 'Atividade prática da aula “Folha, Tributos, Obrigações Acessórias e Reforma Tributária”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 3, 12, date '2027-04-08', true, 112),
  ('rj-2027', 'Atividade da Aula 13', 'Atividade prática da aula “Plano de Manutenção, Inspeção Predial e Autovistoria”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 4, 13, date '2027-05-05', true, 113),
  ('rj-2027', 'Atividade da Aula 14', 'Atividade prática da aula “Obras e Reformas em Áreas Comuns e Unidades (NBR 16280)”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 4, 14, date '2027-05-05', true, 114),
  ('rj-2027', 'Atividade da Aula 15', 'Atividade prática da aula “Sistemas Críticos e Licenças: Bombeiros, Elevadores, SPDA, Gás e Recarga”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 4, 15, date '2027-05-06', true, 115),
  ('rj-2027', 'Atividade da Aula 16', 'Atividade prática da aula “Seguro Condominial e Gestão de Sinistros”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 4, 16, date '2027-05-06', true, 116),
  ('rj-2027', 'Atividade da Aula 17', 'Atividade prática da aula “Conflitos, Mediação e Problemas do Dia a Dia”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 5, 17, date '2027-05-19', true, 117),
  ('rj-2027', 'Atividade da Aula 18', 'Atividade prática da aula “Gestão de Pessoas: Equipe Própria, Terceirização, Trabalhista e NR-01”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 5, 18, date '2027-05-19', true, 118),
  ('rj-2027', 'Atividade da Aula 19', 'Atividade prática da aula “Novas Formas de Moradia: Airbnb, Locação por Temporada e Condomínios de Uso Misto”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 5, 19, date '2027-05-20', true, 119),
  ('rj-2027', 'Atividade da Aula 20', 'Atividade prática da aula “Acessibilidade, Inclusão e Envelhecimento nos Condomínios”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 5, 20, date '2027-05-20', true, 120),
  ('rj-2027', 'Atividade da Aula 21', 'Atividade prática da aula “Inteligência Artificial para Síndicos”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 6, 21, date '2027-06-09', true, 121),
  ('rj-2027', 'Atividade da Aula 22', 'Atividade prática da aula “Tecnologia, Segurança e LGPD no Condomínio”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 6, 22, date '2027-06-09', true, 122),
  ('rj-2027', 'Atividade da Aula 23', 'Atividade prática da aula “Carreira do Síndico Profissional: Posicionamento, Precificação e Captação”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 6, 23, date '2027-06-10', true, 123),
  ('rj-2027', 'Atividade da Aula 24', 'Atividade prática da aula “Simulação de Assembleia e Encerramento”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.', 'pratica', 6, 24, date '2027-06-10', true, 124)
) as v(turma_id, titulo, descricao, tipo, modulo, aula, prazo, aceita_envio, ordem)
where not exists (select 1 from public.tarefas t where t.turma_id = v.turma_id and t.aula = v.aula);


do $$
declare t text;
begin
foreach t in array array['sp-2027','cwb-2027','poa-2027'] loop
  if not exists (select 1 from public.encontros where turma_id = t) then
    insert into public.encontros (turma_id, data, titulo, tipo, aulas, detalhe)
      select t, null, titulo, tipo, aulas, detalhe from public.encontros where turma_id = 'rj-2027' order by data nulls last, id;
    insert into public.tarefas (turma_id, titulo, descricao, tipo, modulo, aula, prazo, aceita_envio, ordem)
      select t, titulo, descricao, tipo, modulo, aula, null, aceita_envio, ordem from public.tarefas where turma_id = 'rj-2027';
    insert into public.avisos (turma_id, titulo, texto)
      values (t, 'Bem-vindo à Formação de Síndicos Profissionais', 'As datas desta turma ainda serão confirmadas. Assim que estiverem definidas, a agenda aparece aqui.');
    update public.turmas set horario = coalesce(horario, 'Quartas e quintas, 18h30 às 22h') where id = t;
  end if;
end loop;
end $$;

select turma_id, (select count(*) from public.encontros e where e.turma_id = x.turma_id) as encontros, count(*) as avaliacoes
from public.tarefas x group by turma_id order by turma_id;
