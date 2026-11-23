# Plataforma do Aluno · Formação de Síndicos Profissionais

Área do aluno e painel do professor. Site estático (HTML + JavaScript, sem build) publicado no GitHub Pages, com login, banco e arquivos no Supabase (plano grátis).

## Como funciona
- `index.html`, `style.css`, `js/app.js`: as telas.
- `js/api.js`: conversa com o Supabase. Se `config.js` estiver vazio, abre a **prévia** com dados de exemplo.
- `config.js`: endereço do Supabase e chave pública (anon). Não coloque aqui a chave `service_role` nem senhas.
- `supabase/01-estrutura.sql`: tabelas, regras de acesso (cada aluno vê só a própria turma e os próprios dados) e pastas de arquivos.
- `supabase/02-conteudo.sql`: módulos, aulas, 4 turmas, calendário e avaliações da turma do Rio.

## Colocar no ar
1. Supabase > SQL Editor: rodar `01-estrutura.sql` e depois `02-conteudo.sql`.
2. Supabase > Authentication > Sign In / Providers > Email: desligar **Confirm email**.
3. Supabase > Project Settings > API: copiar *Project URL* e a chave *anon public* para `config.js`.
4. GitHub > Settings > Pages: Source = branch `main`, pasta `/ (root)`.
5. O professor entra com o e-mail cadastrado como professor em `02-conteudo.sql` (clicando em "Criar minha senha" no primeiro acesso).

## Acesso dos alunos
O professor cadastra nome e e-mail em **Alunos**. No primeiro acesso, o aluno clica em "Criar minha senha". Quem não está matriculado não consegue criar conta. Senha esquecida: o professor define uma nova na ficha do aluno.

## Nota final
Formativas 30% + Projeto Integrador 50% (partes 40%, versão final 60%) + práticas 20%. Certificado: média 7,0 ou mais e presença de 75% ou mais.
