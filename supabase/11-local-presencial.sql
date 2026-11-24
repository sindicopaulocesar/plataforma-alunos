-- 11) Curso presencial: local dos encontros de cada turma (o professor troca em "Agenda e tarefas").
-- Os endereços abaixo são EXEMPLOS para trocar depois. Pode rodar mais de uma vez (não apaga o que já foi editado).
alter table public.turmas add column if not exists local text;

update public.turmas set local = 'A confirmar (exemplo: Av. Rio Branco, 100, Centro, Rio de Janeiro)' where id = 'rj-2027' and local is null;
update public.turmas set local = 'A confirmar (exemplo: Av. Paulista, 1000, Bela Vista, São Paulo)' where id = 'sp-2027' and local is null;
update public.turmas set local = 'A confirmar (exemplo: Rua XV de Novembro, 500, Centro, Curitiba)' where id = 'cwb-2027' and local is null;
update public.turmas set local = 'A confirmar (exemplo: Av. Borges de Medeiros, 300, Centro, Porto Alegre)' where id = 'poa-2027' and local is null;
-- Dias e horário mudam de turma para turma: só o Rio já tem. Nas outras, fica "a confirmar" até o professor definir.
update public.turmas set horario = 'Quartas e quintas, 18h30 às 22h' where id = 'rj-2027' and horario is null;
update public.turmas set horario = null where id <> 'rj-2027' and inicio is null and horario = 'Quartas e quintas, 18h30 às 22h';

select id, nome, local, horario from public.turmas order by id;
