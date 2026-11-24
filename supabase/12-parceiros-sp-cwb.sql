-- 12 · Parceiros: São Paulo = Condohuby, Curitiba = Finocrédito (Porto Alegre segue a definir)
update public.turmas set parceiro = 'Condohuby'   where id = 'sp-2027';
update public.turmas set parceiro = 'Finocrédito' where id = 'cwb-2027';
select id, cidade, parceiro from public.turmas order by id;
