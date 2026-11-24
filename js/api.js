// Camada de dados. Se config.js tiver o endereço do Supabase, usa o banco real;
// se não tiver, usa a prévia com dados de exemplo (nada é salvo).
(function () {
  const cfg = window.CONFIG || {};
  const REAL = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  function nomeSeguro(nome) {
    return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);
  }
  function menos7(data) { const d = new Date(data + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); }
  function novaChave() { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, '0')).join(''); }
  function codDemo(chave, slot) { let h = 2166136261; for (const ch of chave + ':' + slot) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return String(h % 10000).padStart(4, '0'); }
  function erroAmigavel(e) {
    const m = (e && (e.message || e.error_description || String(e))) || 'Erro desconhecido';
    if (/EMAIL_NAO_MATRICULADO|Database error saving new user/i.test(m)) return 'Este e-mail não está na lista de matriculados. Fale com a coordenação.';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered/i.test(m)) return 'Este e-mail já tem senha. Use "Entrar".';
    if (/Password should be at least/i.test(m) || /SENHA_CURTA/.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/Email not confirmed/i.test(m)) return 'O e-mail ainda não foi confirmado. Avise a coordenação.';
    if (/Payload too large|exceeded the maximum/i.test(m)) return 'O arquivo é grande demais.';
    if (/SEM_LOGIN/.test(m)) return 'Sua sessão expirou. Clique em Sair e entre de novo.';
    if (/row-level security|SEM_PROFESSOR/i.test(m)) return 'Você não está mais conectado como professor neste navegador (a sessão expirou ou alguém entrou como aluno em outra aba). Clique em Sair, entre de novo como professor e tente outra vez.';
    if (/SEM_CODIGO/.test(m)) return 'Este encontro ainda não tem código. Clique em "Gerar código da noite".';
    if (/CODIGO_INVALIDO/.test(m)) return 'Código não confere ou já expirou. Digite os 4 números que estão no telão agora.';
    if (/FORA_DO_HORARIO/.test(m)) return 'O código só vale durante o encontro, entre 17h30 e 23h30.';
    if (/MUITAS_TENTATIVAS/.test(m)) return 'Muitas tentativas hoje. Peça ao professor para marcar a sua presença.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com a internet. Tente de novo.';
    return m;
  }

  // ===================== BANCO REAL (Supabase) =====================
  function apiReal() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const ok = (r) => { if (r.error) throw r.error; return r.data; };
    let uid = null;

    return {
      demo: false,
      hoje: () => new Date(),
      async sessao() { const { data } = await sb.auth.getSession(); uid = data.session ? data.session.user.id : null; return uid; },
      async situacaoEmail(email) { return ok(await sb.rpc('situacao_email', { e: email.trim().toLowerCase() })); },
      async entrar(email, senha) { const d = ok(await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })); uid = d.user.id; },
      async criarSenha(email, senha) {
        const d = ok(await sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha }));
        if (!d.session) throw new Error('Email not confirmed');
        uid = d.user.id;
      },
      async sair() { await sb.auth.signOut(); uid = null; },
      async trocarSenha(nova) { ok(await sb.auth.updateUser({ password: nova })); },

      async carregar() {
        const eu = ok(await sb.from('perfis').select('*').eq('id', uid).maybeSingle());
        if (!eu) throw new Error('Seu cadastro não foi encontrado. Fale com a coordenação.');
        const prof = eu.papel === 'professor';
        const q = (t, sel = '*') => sb.from(t).select(sel);
        const [turmas, modulos, aulas, encontros, materiais, tarefas, entregas, notas, presencas, concluidas, avisos, certificados] = (await Promise.all([
          q('turmas').order('inicio', { nullsFirst: false }), q('modulos').order('numero'), q('aulas').order('numero'),
          q('encontros').order('data', { nullsFirst: false }).order('id'), q('materiais').order('aula').order('id'),
          q('tarefas').order('ordem').order('id'), q('entregas'), q('notas'), q('presencas'),
          q('concluidas'), q('avisos').order('criado_em', { ascending: false }), q('certificados')
        ])).map(ok);
        const D = { eu, turmas, modulos, aulas, encontros, materiais, tarefas, entregas, notas, presencas, concluidas, avisos, certificados };
        if (prof) {
          const [alunos, matriculas, mensagens] = (await Promise.all([
            q('perfis').order('nome'), q('matriculas').order('nome'), q('mensagens').order('criado_em', { ascending: false })
          ])).map(ok);
          Object.assign(D, { alunos, matriculas, mensagens });
          const cod = await q('codigos_presenca');
          D.codigos = cod.error ? [] : cod.data;
        }
        return D;
      },

      async urlArquivo(bucket, caminho, baixarComo) {
        const d = ok(await sb.storage.from(bucket).createSignedUrl(caminho, 600, baixarComo ? { download: baixarComo } : undefined));
        return d.signedUrl;
      },
      async marcarConcluida(aula, sim) {
        if (sim) ok(await sb.from('concluidas').upsert({ aluno_id: uid, aula }));
        else ok(await sb.from('concluidas').delete().eq('aluno_id', uid).eq('aula', aula));
      },
      async enviarEntrega(tarefa_id, file) {
        const caminho = `${uid}/${tarefa_id}/${Date.now()}-${nomeSeguro(file.name)}`;
        ok(await sb.storage.from('entregas').upload(caminho, file, { upsert: false }));
        ok(await sb.from('entregas').upsert({ tarefa_id, aluno_id: uid, caminho, nome_arquivo: file.name, enviado_em: new Date().toISOString() }));
      },
      async salvarPerfil(p) { ok(await sb.from('perfis').update(p).eq('id', uid)); },
      async enviarMensagem(texto) { ok(await sb.from('mensagens').insert({ aluno_id: uid, texto })); },

      async marcarPresenca(codigo) {
        const r = String(ok(await sb.rpc('marcar_presenca', { p_codigo: String(codigo).trim() })) || '');
        if (!r.startsWith('OK:')) throw new Error(r.replace('ERRO:', '') || 'CODIGO_INVALIDO');
        return r.slice(3);
      },
      // ---- professor ----
      async gerarCodigo(encontro_id) {
        const codigo = novaChave();
        ok(await sb.from('codigos_presenca').upsert({ encontro_id, codigo, criado_em: new Date().toISOString() }));
        return codigo;
      },
      async codigoAtual(encontro_id) {
        const r = String(ok(await sb.rpc('codigo_atual', { p_encontro: encontro_id })) || '');
        if (r.startsWith('ERRO:') || !r.includes('|')) throw new Error(r.replace('ERRO:', '') || 'SEM_CODIGO');
        const [codigo, resta] = r.split('|'); return { codigo, resta: +resta };
      },
      async salvarTurma(id, campos) { ok(await sb.from('turmas').update(campos).eq('id', id)); },
      async salvarPresencas(encontro_id, mapa) {
        const linhas = Object.entries(mapa).filter(([, s]) => s).map(([aluno_id, status]) => ({ encontro_id, aluno_id, status }));
        const limpar = Object.entries(mapa).filter(([, s]) => !s).map(([a]) => a);
        if (linhas.length) ok(await sb.from('presencas').upsert(linhas));
        if (limpar.length) ok(await sb.from('presencas').delete().eq('encontro_id', encontro_id).in('aluno_id', limpar));
      },
      async salvarNota(tarefa_id, aluno_id, nota, comentario) {
        if (nota === null && !comentario) ok(await sb.from('notas').delete().eq('tarefa_id', tarefa_id).eq('aluno_id', aluno_id));
        else ok(await sb.from('notas').upsert({ tarefa_id, aluno_id, nota, comentario: comentario || null, lancada_em: new Date().toISOString() }));
      },
      async conferirProfessor() {
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) throw new Error('SEM_PROFESSOR');
        const r = await sb.rpc('eh_professor');
        if (r.error || r.data !== true) throw new Error('SEM_PROFESSOR');
      },
      async addMaterial(m) {
        let caminho = null;
        if (m.file) {
          caminho = `${m.turma_id || 'todas'}/aula-${m.aula}/${Date.now()}-${nomeSeguro(m.file.name)}`;
          ok(await sb.storage.from('materiais').upload(caminho, m.file));
        }
        ok(await sb.from('materiais').insert({ aula: m.aula, turma_id: m.turma_id, titulo: m.titulo, caminho, link: m.link || null, liberado_em: m.liberado_em }));
      },
      async removerMaterial(mat) {
        if (mat.caminho) await sb.storage.from('materiais').remove([mat.caminho]);
        ok(await sb.from('materiais').delete().eq('id', mat.id));
      },
      async salvarTarefa(t) {
        const { id, ...resto } = t;
        if (id) ok(await sb.from('tarefas').update(resto).eq('id', id));
        else ok(await sb.from('tarefas').insert(resto));
      },
      async removerTarefa(id) { ok(await sb.from('tarefas').delete().eq('id', id)); },
      async salvarEncontro(e) { const { id, ...resto } = e; if (id) ok(await sb.from('encontros').update(resto).eq('id', id)); else ok(await sb.from('encontros').insert(resto)); },
      async removerEncontro(id) { ok(await sb.from('encontros').delete().eq('id', id)); },
      async salvarAviso(a) { ok(await sb.from('avisos').insert(a)); },
      async removerAviso(id) { ok(await sb.from('avisos').delete().eq('id', id)); },
      async matricular(m) { ok(await sb.from('matriculas').upsert({ ...m, email: m.email.trim().toLowerCase() })); },
      async removerMatricula(email) { ok(await sb.from('matriculas').delete().eq('email', email)); },
      async redefinirSenha(aluno, nova) { ok(await sb.rpc('redefinir_senha', { aluno, nova })); },
      async enviarCertificado(aluno_id, file) {
        const caminho = `${aluno_id}/certificado-${Date.now()}.pdf`;
        ok(await sb.storage.from('certificados').upload(caminho, file, { contentType: 'application/pdf' }));
        ok(await sb.from('certificados').upsert({ aluno_id, caminho, enviado_em: new Date().toISOString() }));
      },
      async marcarLida(id) { ok(await sb.from('mensagens').update({ lida: true }).eq('id', id)); }
    };
  }

  // ===================== PRÉVIA (dados de exemplo, nada é salvo) =====================
  function apiDemo() {
    const C = window.DEMO_CURSO;
    const HOJE = new Date(2027, 3, 15); // a prévia finge que hoje é 15/04/2027
    const iso = (d) => d.toISOString().slice(0, 10);
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const meia = (a, b) => Math.round((a + rnd() * (b - a)) * 2) / 2;

    const turmas = [
      { id: 'rj-2027', cidade: 'Rio de Janeiro', parceiro: 'Centrimóveis', nome: 'Turma Rio de Janeiro 2027', inicio: '2027-02-24', formatura: '2027-06-15', horario: 'Quartas e quintas, 18h30 às 22h', local: 'A confirmar (exemplo: Av. Rio Branco, 100, Centro, Rio de Janeiro)', ativa: true },
      { id: 'sp-2027', cidade: 'São Paulo', parceiro: 'Condohuby', nome: 'Turma São Paulo 2027', inicio: null, formatura: null, horario: null, ativa: true },
      { id: 'cwb-2027', cidade: 'Curitiba', parceiro: 'Finocrédito', nome: 'Turma Curitiba 2027', inicio: null, formatura: null, horario: null, ativa: true },
      { id: 'poa-2027', cidade: 'Porto Alegre', parceiro: 'A definir', nome: 'Turma Porto Alegre 2027', inicio: null, formatura: null, horario: null, ativa: true }
    ];
    let nid = 1000; const novoId = () => ++nid;
    const encontros = [];
    C.datas.forEach((par, i) => par.forEach((data, j) => encontros.push({
      id: novoId(), turma_id: 'rj-2027', data, tipo: 'presencial', aulas: C.aulasNoite[i][j],
      titulo: `Módulo ${C.modulos[i].romano} · ${j ? '2ª' : '1ª'} noite${!i && !j ? ' · aula inaugural' : ''}`, detalhe: null
    })));
    encontros.push({ id: novoId(), turma_id: 'rj-2027', data: '2027-03-24', tipo: 'virtual', aulas: [], titulo: 'Encontro virtual 1', detalhe: 'Convidado: Inaldo Dantas · link enviado no grupo' });
    encontros.push({ id: novoId(), turma_id: 'rj-2027', data: null, tipo: 'virtual', aulas: [], titulo: 'Encontro virtual 2', detalhe: null });
    encontros.push({ id: novoId(), turma_id: 'rj-2027', data: null, tipo: 'virtual', aulas: [], titulo: 'Encontro virtual 3', detalhe: null });

    const tarefas = []; let ordem = 0;
    C.modulos.forEach((m, i) => tarefas.push({ id: novoId(), turma_id: 'rj-2027', titulo: `Avaliação formativa · Módulo ${m.romano}`, descricao: 'Questões respondidas pelo celular ao final do encontro.', tipo: 'formativa', modulo: i + 1, prazo: C.datas[i][1], aceita_envio: false, ordem: ++ordem }));
    C.partes.forEach((t, i) => tarefas.push({ id: novoId(), turma_id: 'rj-2027', titulo: i < 5 ? `Projeto Integrador · Parte ${i + 1}` : 'Projeto Integrador · Versão final', descricao: i < 5 ? t : 'Plano de Gestão de 12 meses consolidado, com IA e tecnologia, LGPD e proposta comercial.', tipo: i < 5 ? 'pi_parte' : 'pi_final', modulo: i + 1, prazo: C.prazos[i], aceita_envio: true, ordem: ++ordem }));
    tarefas.push({ id: novoId(), turma_id: 'rj-2027', titulo: 'Simulação de assembleia', descricao: 'Participação e desempenho na simulação do último encontro.', tipo: 'pratica', modulo: 6, prazo: '2027-06-03', aceita_envio: false, ordem: ++ordem });

    encontros.forEach((e) => e.data && e.aulas.forEach((n) => { const d = new Date(e.data + 'T12:00:00'); d.setDate(d.getDate() + 7); const a = C.aulas.find((x) => x.numero === n); tarefas.push({ id: novoId(), turma_id: 'rj-2027', titulo: `Atividade da Aula ${n}`, descricao: `Atividade prática da aula “${a.titulo}”. Faça a atividade proposta em sala e envie o arquivo aqui até o prazo.`, tipo: 'pratica', modulo: a.modulo, aula: n, prazo: d.toISOString().slice(0, 10), aceita_envio: true, ordem: 100 + n }); }));

    // materiais: as ferramentas do Kit de cada aula, liberadas na noite da aula
    const materiais = [];
    const noiteDaAula = {}; encontros.forEach((e) => e.aulas.forEach((a) => { noiteDaAula[a] = e.data; }));
    Object.entries(C.kit).forEach(([a, lista]) => lista.forEach(([t, ext]) => materiais.push({ id: novoId(), aula: +a, turma_id: null, titulo: t, caminho: `todas/aula-${a}/${t}.${ext}`, link: null, liberado_em: noiteDaAula[a] })));
    C.aulas.forEach((a) => { if (noiteDaAula[a.numero] < '2027-04-14') materiais.push({ id: novoId(), aula: a.numero, turma_id: 'rj-2027', titulo: 'Slides da aula', caminho: `rj-2027/aula-${a.numero}/slides.pdf`, link: null, liberado_em: noiteDaAula[a.numero] }); });

    const NOMES = ['Mariana Duarte', 'Carlos Almeida', 'Ana Barbosa', 'Rafael Cardoso', 'Juliana Teixeira', 'Marcelo Moreira', 'Patrícia Nogueira', 'Bruno Pacheco', 'Fernanda Ribeiro', 'Ricardo Siqueira', 'Luciana Tavares', 'André Vasconcelos', 'Camila Azevedo', 'Eduardo Brandão', 'Beatriz Coelho', 'Gustavo Fonseca', 'Renata Guimarães', 'Felipe Lacerda', 'Aline Monteiro', 'Roberto Peixoto', 'Tatiana Rangel', 'Leonardo Queiroz', 'Simone Mattos', 'Thiago Duarte', 'Cristina Almeida', 'Daniela Barbosa', 'Rodrigo Cardoso', 'Vanessa Teixeira'];
    const alunos = NOMES.map((nome, i) => ({ id: 'aluno-' + (i + 1), email: nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@email.com', nome, telefone: i ? null : '(21) 99999-0000', atuacao: i ? null : 'Síndica moradora · Botafogo', papel: 'aluno', turma_id: 'rj-2027', criado_em: '2027-02-10' }));
    const prof = { id: 'prof', email: 'formacaodesindicos@gmail.com', nome: 'Prof. Paulo Cesar da Silva', papel: 'professor', turma_id: null };
    const matriculas = [...alunos.map((a) => ({ email: a.email, nome: a.nome, turma_id: a.turma_id, papel: 'aluno' })),
      { email: 'joao.pereira@email.com', nome: 'João Pereira', turma_id: 'rj-2027', papel: 'aluno' },
      { email: prof.email, nome: prof.nome, turma_id: null, papel: 'professor' }];

    const passados = encontros.filter((e) => e.data && e.data < iso(HOJE));
    const presencas = [], notas = [], entregas = [], concluidas = [];
    alunos.forEach((al, i) => {
      const fraco = i > 0 && rnd() < 0.18;
      passados.forEach((e) => { const r = i === 0 ? (e.data === '2027-03-11' ? 0.9 : 0) : rnd(); presencas.push({ encontro_id: e.id, aluno_id: al.id, status: r < 0.86 ? 'P' : r < 0.93 ? 'R' : 'F' }); });
      tarefas.forEach((t) => {
        if (t.prazo >= iso(HOJE)) return;
        if (t.aceita_envio) {
          if (i > 0 && rnd() < 0.06) return;
          entregas.push({ tarefa_id: t.id, aluno_id: al.id, caminho: `${al.id}/${t.id}/entrega.docx`, nome_arquivo: 'Plano de gestão.docx', enviado_em: t.prazo + 'T21:00:00Z' });
        }
        const nota = i === 0 ? ({ formativa: [8.5, 7, 9], pi_parte: [8, 7.5] }[t.tipo] || [])[t.modulo - 1] : meia(fraco ? 4.5 : 6.5, fraco ? 7.5 : 10);
        if (nota != null) notas.push({ tarefa_id: t.id, aluno_id: al.id, nota, comentario: t.tipo === 'pi_parte' && i === 0 ? (t.modulo === 1 ? 'Diagnóstico bem documentado, com fotos por sistema. Priorize na matriz GUT a impermeabilização da cobertura.' : 'O fluxo de penalidades respeita o direito de defesa. O plano diretor precisa de valores estimados por eixo.') : null, lancada_em: t.prazo });
      });
      C.aulas.forEach((a) => { if (noiteDaAula[a.numero] < iso(HOJE) && (i === 0 ? a.numero < 9 : rnd() < 0.5)) concluidas.push({ aluno_id: al.id, aula: a.numero, em: noiteDaAula[a.numero] }); });
    });
    const avisos = [
      { id: novoId(), turma_id: 'rj-2027', titulo: 'Slides do Módulo III publicados', texto: 'Aulas 7 a 10. Estão na página de cada aula.', criado_em: '2027-04-02T12:00:00Z' },
      { id: novoId(), turma_id: 'rj-2027', titulo: 'Parte 2 do Projeto Integrador corrigida', texto: 'As notas e as devolutivas já estão em Tarefas e notas.', criado_em: '2027-04-05T12:00:00Z' },
      { id: novoId(), turma_id: null, titulo: 'Bem-vindos à Formação de Síndicos Profissionais', texto: 'Qualquer dúvida, use a página Meu perfil e contato.', criado_em: '2027-02-20T12:00:00Z' }
    ];
    const mensagens = [{ id: novoId(), aluno_id: 'aluno-4', texto: 'Professor, posso usar o condomínio onde moro no Projeto Integrador?', lida: false, criado_em: '2027-04-13T14:20:00Z' }];
    const certificados = [];
    const D = { codigos: [], turmas, modulos: C.modulos, aulas: C.aulas, encontros, materiais, tarefas, entregas, notas, presencas, concluidas, avisos, certificados, alunos, matriculas, mensagens };
    let eu = null;
    const espera = () => new Promise((r) => setTimeout(r, 150));
    const visivel = (D2) => {
      if (eu.papel === 'professor') return { ...D2, alunos: [...D2.alunos, prof] };
      const t = eu.turma_id, hoje = iso(HOJE);
      return {
        turmas: D2.turmas.filter((x) => x.id === t), modulos: D2.modulos, aulas: D2.aulas,
        encontros: D2.encontros.filter((x) => x.turma_id === t),
        materiais: D2.materiais.filter((x) => (!x.turma_id || x.turma_id === t) && D2.encontros.some((e) => e.turma_id === t && e.data && e.aulas.includes(x.aula) && menos7(e.data) <= hoje)),
        tarefas: D2.tarefas.filter((x) => x.turma_id === t), avisos: D2.avisos.filter((x) => !x.turma_id || x.turma_id === t),
        entregas: D2.entregas.filter((x) => x.aluno_id === eu.id), notas: D2.notas.filter((x) => x.aluno_id === eu.id),
        presencas: D2.presencas.filter((x) => x.aluno_id === eu.id), concluidas: D2.concluidas.filter((x) => x.aluno_id === eu.id),
        certificados: D2.certificados.filter((x) => x.aluno_id === eu.id)
      };
    };
    const up = (arr, chave, obj) => { const i = arr.findIndex((x) => chave.every((k) => x[k] === obj[k])); if (i >= 0) arr[i] = { ...arr[i], ...obj }; else arr.push(obj); };

    return {
      demo: true,
      hoje: () => new Date(HOJE),
      async sessao() { return eu ? eu.id : null; },
      async situacaoEmail(email) { return matriculas.some((m) => m.email === email.trim().toLowerCase()) ? 'tem_senha' : 'nao_matriculado'; },
      async entrar(email) { await espera(); const e = email.trim().toLowerCase(); eu = e === prof.email ? prof : alunos.find((a) => a.email === e) || alunos[0]; },
      async entrarComo(papel) { eu = papel === 'professor' ? prof : alunos[0]; },
      async criarSenha(email, senha) { return this.entrar(email, senha); },
      async sair() { eu = null; },
      async trocarSenha() { await espera(); },
      async carregar() { await espera(); return { eu, ...visivel(D) }; },
      async urlArquivo() { return null; },
      async marcarConcluida(aula, sim) { const i = concluidas.findIndex((c) => c.aluno_id === eu.id && c.aula === aula); if (sim && i < 0) concluidas.push({ aluno_id: eu.id, aula, em: new Date().toISOString() }); if (!sim && i >= 0) concluidas.splice(i, 1); },
      async enviarEntrega(tarefa_id, file) { await espera(); up(entregas, ['tarefa_id', 'aluno_id'], { tarefa_id, aluno_id: eu.id, caminho: 'x', nome_arquivo: file.name, enviado_em: new Date().toISOString() }); },
      async salvarPerfil(p) { Object.assign(eu, p); },
      async enviarMensagem(texto) { mensagens.unshift({ id: novoId(), aluno_id: eu.id, texto, lida: false, criado_em: new Date().toISOString() }); },
      async marcarPresenca(codigo) {
        const slot = Math.floor(Date.now() / 40000), c0 = String(codigo).trim();
        const e = D.encontros.find((x) => { const c = D.codigos.find((y) => y.encontro_id === x.id); return x.turma_id === eu.turma_id && x.data === iso(HOJE) && c && [0, 1, 2].some((k) => codDemo(c.codigo, slot - k) === c0); });
        if (!e) throw new Error('CODIGO_INVALIDO');
        up(presencas, ['encontro_id', 'aluno_id'], { encontro_id: e.id, aluno_id: eu.id, status: 'P' }); return e.titulo;
      },
      async salvarTurma(id, campos) { Object.assign(D.turmas.find((x) => x.id === id) || {}, campos); },
      async gerarCodigo(encontro_id) { const codigo = novaChave(); up(D.codigos, ['encontro_id'], { encontro_id, codigo }); return codigo; },
      async codigoAtual(encontro_id) { const c = D.codigos.find((y) => y.encontro_id === encontro_id); if (!c) throw new Error('SEM_CODIGO'); const ms = Date.now(), slot = Math.floor(ms / 40000); return { codigo: codDemo(c.codigo, slot), resta: Math.ceil(((slot + 1) * 40000 - ms) / 1000) }; },
      async salvarPresencas(encontro_id, mapa) { Object.entries(mapa).forEach(([aluno_id, status]) => { const i = presencas.findIndex((p) => p.encontro_id === encontro_id && p.aluno_id === aluno_id); if (i >= 0) presencas.splice(i, 1); if (status) presencas.push({ encontro_id, aluno_id, status }); }); },
      async salvarNota(tarefa_id, aluno_id, nota, comentario) { const i = notas.findIndex((n) => n.tarefa_id === tarefa_id && n.aluno_id === aluno_id); if (i >= 0) notas.splice(i, 1); if (nota !== null || comentario) notas.push({ tarefa_id, aluno_id, nota, comentario, lancada_em: new Date().toISOString() }); },
      async addMaterial(m) { materiais.push({ id: novoId(), aula: m.aula, turma_id: m.turma_id, titulo: m.titulo, caminho: m.file ? m.file.name : null, link: m.link || null, liberado_em: m.liberado_em }); },
      async conferirProfessor() {},
      async removerMaterial(mat) { materiais.splice(materiais.findIndex((x) => x.id === mat.id), 1); },
      async salvarTarefa(t) { if (t.id) Object.assign(tarefas.find((x) => x.id === t.id), t); else tarefas.push({ ...t, id: novoId() }); },
      async removerTarefa(id) { tarefas.splice(tarefas.findIndex((x) => x.id === id), 1); },
      async salvarEncontro(e) { if (e.id) Object.assign(encontros.find((x) => x.id === e.id), e); else encontros.push({ ...e, id: novoId() }); },
      async removerEncontro(id) { encontros.splice(encontros.findIndex((x) => x.id === id), 1); },
      async salvarAviso(a) { avisos.unshift({ ...a, id: novoId(), criado_em: new Date().toISOString() }); },
      async removerAviso(id) { avisos.splice(avisos.findIndex((x) => x.id === id), 1); },
      async matricular(m) { up(matriculas, ['email'], { ...m, email: m.email.trim().toLowerCase() }); const a = alunos.find((x) => x.email === m.email); if (a) Object.assign(a, { nome: m.nome, turma_id: m.turma_id }); },
      async removerMatricula(email) { matriculas.splice(matriculas.findIndex((x) => x.email === email), 1); },
      async redefinirSenha() { await espera(); },
      async enviarCertificado(aluno_id) { up(certificados, ['aluno_id'], { aluno_id, caminho: 'x', enviado_em: new Date().toISOString() }); },
      async marcarLida(id) { mensagens.find((m) => m.id === id).lida = true; }
    };
  }

  window.API = REAL ? apiReal() : apiDemo();
  window.API.erroAmigavel = erroAmigavel;
})();
