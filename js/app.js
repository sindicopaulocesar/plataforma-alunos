// Plataforma do Aluno · Formação de Síndicos Profissionais
(function () {
  const API = window.API;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dt = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const fd = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—';
  const fdl = (s) => s ? `${+s.slice(8, 10)} de ${MESL[+s.slice(5, 7) - 1]}` : 'a definir';
  const isoHoje = () => { const h = API.hoje(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; };
  const dias = (s) => Math.round((dt(s) - dt(isoHoje())) / 864e5);
  const n1 = (v) => v == null || isNaN(v) ? '—' : v.toFixed(1).replace('.', ',');
  const media = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const ini = (n) => (n || '?').replace(/^(Prof\.|Dr\.|Dra\.)\s*/, '').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const nomeBonito = (n) => n.replace(/\.[^.]+$/, '').replace(/^\d+\s*[-–.]\s*/, '').replace(/_/g, ' ').trim();
  const ext = (c) => ((c || '').split('.').pop() || '').toLowerCase().slice(0, 4);
  const PESOS = { formativa: 0.3, pi: 0.5, pratica: 0.2 };
  const TIPOS = { formativa: 'Avaliação formativa', pi_parte: 'Projeto Integrador · parte', pi_final: 'Projeto Integrador · versão final', pratica: 'Prática / simulação' };
  const COMP = { formativa: 'Formativas', pi_parte: 'Projeto', pi_final: 'Projeto', pratica: 'Práticas' };

  let D = null;          // dados carregados
  let TURMA = null;      // turma em foco (o professor pode trocar)
  try { TURMA = localStorage.getItem('turma'); } catch (e) { /* sem armazenamento */ }

  // ---------- avisos rápidos ----------
  function toast(msg, ruim) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', !!ruim); t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ruim ? 6000 : 3200);
  }
  async function tentar(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) { console.error(e); toast(API.erroAmigavel(e), true); return false; }
  }

  // ---------- ícones ----------
  const ICON = {
    inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    aulas: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/>',
    tarefas: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 14h8M9 18h5"/>',
    notas: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    certificado: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
    painel: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
    alunos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.2 2.6 3.7 5.5"/>',
    chamada: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11h6M9 15h4"/>',
    correcoes: '<path d="M5 3h10l4 4v14H5z"/><path d="M9 14l2 2 4-4"/>',
    materiais: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    avisos: '<path d="M4 10v4h4l6 5V5L8 10z"/><path d="M18 9a4 4 0 0 1 0 6"/>'
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const NAV_ALUNO = [['inicio', 'Início'], ['aulas', 'Aulas'], ['agenda', 'Agenda'], ['tarefas', 'Tarefas e notas'], ['certificado', 'Certificado'], ['perfil', 'Perfil e contato']];
  const TAB_ALUNO = ['inicio', 'aulas', 'agenda', 'tarefas', 'perfil'];
  const NAV_PROF = [['p-painel', 'Painel', 'painel'], ['p-alunos', 'Alunos', 'alunos'], ['p-presenca', 'Presença', 'chamada'], ['p-notas', 'Notas e entregas', 'correcoes'], ['p-materiais', 'Materiais', 'materiais'], ['p-agenda', 'Agenda e tarefas', 'agenda'], ['p-avisos', 'Avisos e mensagens', 'avisos'], ['p-certificados', 'Certificados', 'certificado']];
  const TAB_PROF = ['p-painel', 'p-alunos', 'p-presenca', 'p-notas', 'p-materiais'];

  // ---------- cálculos ----------
  const ehProf = () => D && D.eu.papel === 'professor';
  const turma = () => D.turmas.find((t) => t.id === TURMA) || D.turmas[0] || { id: null, nome: 'Sem turma', cidade: '', parceiro: '' };
  const parceiroDe = (t) => (t && t.parceiro && !/^a definir$/i.test(t.parceiro.trim()) ? t.parceiro : '');
  const daTurma = (arr) => arr.filter((x) => x.turma_id === TURMA);
  const encontrosT = () => daTurma(D.encontros).sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || a.id - b.id);
  const tarefasT = () => daTurma(D.tarefas).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  const alunosT = () => (D.alunos || []).filter((a) => a.papel === 'aluno' && a.turma_id === TURMA);
  const aula = (n) => D.aulas.find((a) => a.numero === n);
  const modulo = (n) => D.modulos.find((m) => m.numero === n);
  const noiteDa = (n) => encontrosT().find((e) => e.aulas.includes(n));
  const aulaAberta = (n) => { const e = noiteDa(n); return !e || !e.data || e.data <= isoHoje(); };
  const materiaisDa = (n) => D.materiais.filter((m) => m.aula === n && (!m.turma_id || m.turma_id === TURMA) && (ehProf() || m.liberado_em <= isoHoje()));

  function resumo(alunoId) {
    const encs = encontrosT(), hoje = isoHoje();
    const realizados = encs.filter((e) => e.data && e.data <= hoje);
    const pres = D.presencas.filter((p) => p.aluno_id === alunoId && encs.some((e) => e.id === p.encontro_id));
    const presentes = pres.filter((p) => p.status === 'P' || p.status === 'R').length;
    const faltas = pres.filter((p) => p.status === 'F').length;
    const total = encs.length;
    const minimo = Math.ceil(total * 0.75);
    const freq = realizados.length ? presentes / Math.max(realizados.length, presentes + faltas) : null;
    const tars = tarefasT();
    const nota = (t) => { const n = D.notas.find((x) => x.tarefa_id === t.id && x.aluno_id === alunoId); return n && n.nota != null ? +n.nota : null; };
    const grupo = (tipo) => tars.filter((t) => t.tipo === tipo).map(nota).filter((v) => v != null);
    const fm = media(grupo('formativa')), pm = media(grupo('pi_parte')), pf = media(grupo('pi_final')), pr = media(grupo('pratica'));
    const pi = pf != null && pm != null ? 0.4 * pm + 0.6 * pf : pf != null ? pf : pm;
    const comps = [[fm, PESOS.formativa], [pi, PESOS.pi], [pr, PESOS.pratica]].filter(([v]) => v != null);
    const somaP = comps.reduce((s, [, p]) => s + p, 0);
    const final = somaP ? comps.reduce((s, [v, p]) => s + v * p, 0) / somaP : null;
    const auls = D.aulas.map((a) => a.numero);
    const concl = new Set(D.concluidas.filter((c) => c.aluno_id === alunoId).map((c) => c.aula));
    encs.forEach((e) => { const p = pres.find((x) => x.encontro_id === e.id); if (p && p.status !== 'F') e.aulas.forEach((a) => concl.add(a)); });
    const progresso = auls.length ? auls.filter((a) => concl.has(a)).length / auls.length : 0;
    const pendentes = tars.filter((t) => t.aceita_envio && !D.entregas.some((x) => x.tarefa_id === t.id && x.aluno_id === alunoId));
    return { total, minimo, realizados: realizados.length, presentes, faltas, freq, fm, pm, pf, pi, pr, final, concl, progresso, pendentes, nota, completo: tars.length && tars.every((t) => nota(t) != null) };
  }
  const pill = (txt, k) => `<span class="pill p-${k}">${txt}</span>`;
  const bar = (v, acc) => `<div class="bar ${acc ? 'acc' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, v || 0)) * 100)}%"></i></div>`;
  const fileicon = (c, link) => { const e = link ? 'link' : ext(c); const cls = { xlsx: 'xlsx', xls: 'xlsx', docx: 'docx', doc: 'docx', pdf: 'pdf' }[e] || 'other'; return `<span class="fileicon ft-${cls}">${esc((e || 'arq').toUpperCase())}</span>`; };
  const demoBar = () => API.demo ? `<div class="demo"><span><b>Prévia com dados de exemplo.</b> A data simulada é 15/04/2027 e nada do que você fizer aqui é salvo.</span><a class="linkbtn" href="#sair">Trocar de perfil</a></div>` : '';

  // ---------- casca ----------
  function montarCasca() {
    const prof = ehProf(), t = turma();
    const nav = prof ? NAV_PROF.map(([k, l, i]) => [k, l, i]) : NAV_ALUNO.map(([k, l]) => [k, l, k]);
    $('#sidenav').innerHTML = nav.map(([k, l, i]) => `<a href="#${k}" data-nav="${k}">${svg(i)}<span>${l}</span>${k === 'p-avisos' && naoLidas() ? `<span class="badge">${naoLidas()}</span>` : ''}</a>`).join('');
    const tabs = prof ? TAB_PROF : TAB_ALUNO;
    $('#tabbar').style.setProperty('--n', tabs.length + (prof ? 1 : 0));
    $('#tabbar').innerHTML = tabs.map((k) => { const it = nav.find((x) => x[0] === k); return `<a href="#${k}" data-nav="${k}">${svg(it[2])}<span>${it[1].split(' ')[0]}</span></a>`; }).join('') + (prof ? `<a href="#p-mais" data-nav="p-mais">${svg('painel')}<span>Mais</span></a>` : '');
    $('#partner').innerHTML = prof ? 'Coordenação do curso' : `${esc(t.nome)}${parceiroDe(t) ? ` · <b>${esc(parceiroDe(t))}</b>` : ''}`;
    $('#who').innerHTML = `<span class="avatar">${esc(ini(D.eu.nome))}</span><span style="min-width:0"><b style="display:block;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(D.eu.nome)}</b><button type="button" id="logout">Sair</button></span>`;
    $('#mtAv').textContent = ini(D.eu.nome);
    $('#mtAv').href = prof ? '#p-painel' : '#perfil';
    $('#logout').onclick = sair;
  }
  const naoLidas = () => (D.mensagens || []).filter((m) => !m.lida).length;

  // ---------- telas do aluno ----------
  const V = {};

  const presencaHoje = () => {
    const hoje = isoHoje(), e = encontrosT().find((x) => x.data === hoje && x.tipo === 'presencial');
    if (!e || D.eu.papel === 'professor') return '';
    const p = D.presencas.find((x) => x.encontro_id === e.id && x.aluno_id === D.eu.id);
    if (p && (p.status === 'P' || p.status === 'R')) return `<div class="card codigo-noite ok"><div><b>Presença de hoje confirmada</b><p class="small muted">${esc(e.titulo)}. Bom encontro!</p></div></div>`;
    return `<form class="card codigo-noite" id="presForm"><div><b>Presença de hoje</b><p class="small muted">Digite o código de 4 números que o professor mostrar no encontro.</p></div>
      <div style="display:flex;gap:8px;align-items:center"><input id="presCod" class="input codigo-in num" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="0000" aria-label="Código da noite"><button class="btn btn-primary" type="submit">Marcar presença</button></div></form>`;
  };
  V.inicio = () => {
    const r = resumo(D.eu.id), t = turma(), hoje = isoHoje();
    const prox = encontrosT().find((e) => e.data && e.data >= hoje);
    const nome = D.eu.nome.split(' ')[0];
    const pend = r.pendentes.filter((x) => !x.prazo || x.prazo >= hoje).slice(0, 3);
    const atras = r.pendentes.filter((x) => x.prazo && x.prazo < hoje);
    const ult = D.materiais.filter((m) => !m.turma_id || m.turma_id === TURMA).sort((a, b) => b.liberado_em.localeCompare(a.liberado_em)).slice(0, 4);
    return `${demoBar()}
    <section class="band"><div class="facade" aria-hidden="true">${fachada(60)}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="eyebrow">Olá, ${esc(nome)} · ${prox ? 'próximo encontro' : 'curso'}</span>
        <h1>${prox ? esc(prox.titulo) : esc(t.nome)}</h1>
        <p class="when">${prox ? `${DOW[dt(prox.data).getDay()]}, ${fdl(prox.data)}${prox.tipo === 'presencial' ? ' · ' + esc(t.horario || '18h30') : ' · on-line'}${prox.aulas.length ? ' · Aula' + (prox.aulas.length > 1 ? 's ' : ' ') + prox.aulas.join(' e ') : ''}` : 'Todos os encontros já aconteceram.'}</p>
      </div>
      ${prox ? `<div class="date"><b class="num">${dias(prox.data)}</b><span>${dias(prox.data) === 1 ? 'dia' : 'dias'}</span></div>` : ''}
    </section>
    ${presencaHoje()}
    <div class="grid g3">
      <div class="card stat"><span class="eyebrow">Progresso no curso</span><span class="big num">${Math.round(r.progresso * 100)}%</span>${bar(r.progresso)}<span class="small muted">${r.concl.size} de ${D.aulas.length} aulas concluídas</span></div>
      <div class="card stat"><span class="eyebrow">Frequência</span><span class="big num">${r.freq == null ? '—' : Math.round(r.freq * 100) + '%'}</span>${bar(r.freq)}<span class="small muted">${r.presentes} de ${r.realizados} encontros realizados · mínimo 75%</span></div>
      <div class="card stat"><span class="eyebrow">Nota parcial</span><span class="big num">${n1(r.final)}</span>${bar(r.final == null ? 0 : r.final / 10, true)}<span class="small muted">Com as notas lançadas até agora · mínimo 7,0</span></div>
    </div>
    <div class="split">
      <div class="card"><h2>Para entregar</h2>
        ${atras.length ? `<p class="small" style="color:var(--bad)">Você tem ${atras.length} entrega${atras.length > 1 ? 's' : ''} com prazo vencido. Ainda dá para enviar em Tarefas e notas.</p>` : ''}
        <div class="list">${pend.length ? pend.map((x) => `<div class="row">${x.prazo ? pill(dias(x.prazo) + (dias(x.prazo) === 1 ? ' dia' : ' dias'), dias(x.prazo) <= 7 ? 'warn' : 'neutral') : ''}<div class="grow"><div class="t">${esc(x.titulo)}</div><div class="s">${esc(x.descricao || '')}${x.prazo ? ' · até ' + fd(x.prazo) : ''}</div></div><a class="btn btn-primary small" href="#tarefas">Enviar</a></div>`).join('') : '<p class="muted">Nada pendente agora. Bom trabalho.</p>'}</div>
      </div>
      <div class="card"><h2>Avisos da coordenação</h2>
        <div class="list">${D.avisos.slice(0, 4).map((a) => `<div class="row"><div class="grow"><div class="t">${esc(a.titulo)}</div><div class="s">${esc(a.texto || '')} · ${fd(a.criado_em)}</div></div></div>`).join('') || '<p class="muted">Sem avisos por enquanto.</p>'}</div>
        <a class="btn btn-ghost small" href="#perfil" style="align-self:flex-start">Falar com a coordenação</a>
      </div>
    </div>
    ${ult.length ? `<div class="card"><div class="cardhead"><h2>Materiais mais recentes</h2><a class="linkbtn" href="#aulas">Ver todas as aulas</a></div>
      <div class="grid g2">${ult.map((m) => `<a class="row tile" href="#aula-${m.aula}">${fileicon(m.caminho, m.link)}<div class="grow"><div class="aula-n">Aula ${m.aula}</div><div class="t">${esc(m.titulo)}</div><div class="s">${esc(aula(m.aula) ? aula(m.aula).titulo : '')}</div></div></a>`).join('')}</div></div>` : ''}`;
  };

  let abertos = null;
  V.aulas = () => {
    const r = resumo(D.eu.id), hoje = isoHoje();
    if (!abertos) { const atual = D.modulos.find((m) => D.aulas.filter((a) => a.modulo === m.numero).some((a) => !r.concl.has(a.numero))); abertos = new Set([atual ? atual.numero : 1]); }
    return `${demoBar()}<div class="pagehead"><span class="eyebrow">${D.modulos.length} módulos · ${D.aulas.length} aulas</span><h1>Trilha de aulas</h1><p class="muted">Siga a trilha na ordem. Abra uma aula para ver a ementa e baixar os materiais. Os materiais abrem na noite do encontro.</p>
      <div style="max-width:420px;margin-top:6px">${bar(r.progresso)}<span class="small muted">${r.concl.size} de ${D.aulas.length} aulas concluídas</span></div></div>
    <div style="display:flex;flex-direction:column;gap:12px">${D.modulos.map((m) => {
      const as = D.aulas.filter((a) => a.modulo === m.numero);
      const noites = encontrosT().filter((e) => e.aulas.some((n) => as.some((a) => a.numero === n)));
      const ini0 = noites[0] && noites[0].data, fim = noites.length && noites[noites.length - 1].data;
      const feitas = as.filter((a) => r.concl.has(a.numero)).length;
      const bloq = ini0 && ini0 > hoje;
      const st = feitas === as.length ? pill('Concluído', 'ok') : bloq ? pill('Abre em ' + fd(ini0), 'neutral') : pill(`${feitas} de ${as.length} aulas`, 'warn');
      const open = abertos.has(m.numero);
      return `<div class="mod ${bloq ? 'locked' : ''}" open-state="${open ? 1 : 0}">
        <button class="mod-head" type="button" data-mod="${m.numero}" aria-expanded="${open}"><span class="roman">${esc(m.romano)}</span><span style="min-width:0"><span class="eyebrow">${ini0 ? fd(ini0) + (fim && fim !== ini0 ? ' e ' + fd(fim) : '') : 'Módulo ' + m.numero}</span><h3 style="margin-top:2px">${esc(m.titulo)}</h3></span><span style="display:flex;gap:10px;align-items:center">${st}<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></span></button>
        ${open ? `<div class="mod-body">${as.map((a) => { const n = materiaisDa(a.numero).length, ok = r.concl.has(a.numero); return `<a class="aula-row" href="#aula-${a.numero}"><span class="aula-n">${ok ? '<span class="ck y sm">✓</span>' : ''}Aula ${a.numero}</span><span style="min-width:0"><span class="t" style="font-weight:700;display:block">${esc(a.titulo)}</span><span class="small muted">${esc(a.docente || '')}</span></span>${aulaAberta(a.numero) ? (n ? pill(n + (n > 1 ? ' materiais' : ' material'), 'brand') : pill('Aberta', 'neutral')) : pill('Bloqueada', 'neutral')}</a>`; }).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  };

  V.aula = (n) => {
    const a = aula(n); if (!a) return V.aulas();
    const m = modulo(a.modulo), e = noiteDa(n), aberta = aulaAberta(n), mats = materiaisDa(n);
    const r = resumo(D.eu.id), ok = r.concl.has(n);
    const nums = D.aulas.map((x) => x.numero), i = nums.indexOf(n);
    return `${demoBar()}<div class="crumbs"><a href="#aulas">Aulas</a><span>›</span><span>Módulo ${esc(m.romano)}</span><span>›</span><span>Aula ${n}</span></div>
    <div class="pagehead"><span class="eyebrow">Aula ${n} · Módulo ${esc(m.romano)} · ${esc(m.titulo)}</span><h1>${esc(a.titulo)}</h1></div>
    <div class="facts-row"><div><span class="eyebrow">Docente</span><span>${esc(a.docente || 'a confirmar')}</span></div><div><span class="eyebrow">Encontro</span><span class="num">${e && e.data ? `${DOW[dt(e.data).getDay()]}, ${fd(e.data)} · 18h30` : 'a definir'}</span></div><div><span class="eyebrow">Situação</span><span>${ok ? pill('Concluída', 'ok') : aberta ? pill('Liberada', 'brand') : pill('Abre na noite da aula', 'neutral')}</span></div></div>
    <div class="split">
      <div class="card"><h2>Sobre a aula</h2>
        <dl class="ficha">${a.objetivo ? `<dt>Objetivo</dt><dd>${esc(a.objetivo)}</dd>` : ''}${a.ementa && a.ementa.length ? `<dt>Ementa</dt><dd><ul class="ementa">${a.ementa.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>` : ''}${a.pratica ? `<dt>Prática em sala</dt><dd>${esc(a.pratica)}</dd>` : ''}${a.base_legal ? `<dt>Base legal</dt><dd>${esc(a.base_legal)}</dd>` : ''}</dl>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="card"><h2>Materiais da aula</h2>
          ${!aberta ? `<div class="lockbox"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="small">Os materiais desta aula ficam disponíveis em ${fd(e.data)}, na noite do encontro.</span></div>` : ''}
          <div class="list">${mats.map((x) => `<div class="row">${fileicon(x.caminho, x.link)}<div class="grow"><div class="t">${esc(x.titulo)}</div><div class="s">${x.link ? 'Link externo' : 'Kit do Síndico · ' + esc(ext(x.caminho).toUpperCase())}</div></div><button class="btn btn-ghost small" type="button" data-baixar="${x.id}">${x.link ? 'Abrir' : 'Baixar'}</button></div>`).join('') || (aberta ? '<p class="muted small">Ainda não há materiais publicados para esta aula.</p>' : '')}</div>
        </div>
        ${(() => { const t = tarefasT().find((x) => x.aula === n); if (!t) return ''; const ent = D.entregas.find((x) => x.tarefa_id === t.id && x.aluno_id === D.eu.id), nt = r.nota(t);
          return `<div class="card"><h2>Atividade desta aula</h2><p class="small muted">${esc(t.descricao || '')}</p><div style="margin:10px 0">${nt != null ? pill('Corrigida · nota ' + n1(nt), 'ok') : ent ? pill('Enviada · aguardando correção', 'brand') : t.prazo ? pill('Entrega até ' + fd(t.prazo), t.prazo < isoHoje() ? 'bad' : 'warn') : ''}</div><a class="btn ${ent ? 'btn-ghost' : 'btn-primary'} small" href="#tarefas">${ent ? 'Ver na tela de tarefas' : 'Enviar a atividade'}</a></div>`; })()}
        ${aberta ? `<div class="card"><h2>Sua trilha</h2><p class="small muted">Marque quando terminar de estudar esta aula. A presença no encontro também conta como aula concluída.</p>
          <button class="btn ${ok ? 'btn-ghost' : 'btn-primary'}" type="button" id="concluir" data-on="${ok ? 0 : 1}">${ok ? 'Desmarcar aula concluída' : 'Marcar aula como concluída'}</button></div>` : ''}
      </div>
    </div>
    <div class="pager">${i > 0 ? `<a class="btn btn-ghost" href="#aula-${nums[i - 1]}">‹ Aula ${nums[i - 1]}</a>` : '<span></span>'}${i < nums.length - 1 ? `<a class="btn btn-ghost" href="#aula-${nums[i + 1]}">Aula ${nums[i + 1]} ›</a>` : ''}</div>`;
  };

  function linhaDoTempo(encs, alunoId) {
    const hoje = isoHoje(), t = turma(); let prox = false;
    const itens = encs.map((e) => ({ ...e }));
    if (t.formatura) itens.push({ data: t.formatura, titulo: 'Formatura', detalhe: 'Entrega dos certificados ESIC', tipo: 'formatura', aulas: [] });
    itens.sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
    return `<div class="timeline">${itens.map((it) => {
      let cls = '', p = '';
      const pr = alunoId && it.id ? D.presencas.find((x) => x.encontro_id === it.id && x.aluno_id === alunoId) : null;
      if (it.data) {
        if (it.data < hoje) { cls = 'done'; p = pr ? (pr.status === 'F' ? pill('Falta', 'bad') : pr.status === 'R' ? pill('Reposição', 'warn') : pill('Presente', 'ok')) : pill('Realizado', 'neutral'); }
        else if (!prox && it.tipo !== 'formatura') { cls = 'next'; prox = true; p = pill('Próximo', 'warn'); }
      } else p = pill('Data a definir', 'neutral');
      if (it.tipo === 'formatura') cls += ' grad';
      const sub = it.aulas.length ? it.aulas.map((n) => `<a href="#aula-${n}">Aula ${n} · ${esc(aula(n) ? aula(n).titulo : '')}</a>`).join('<br>') : esc(it.detalhe || (it.tipo === 'virtual' ? 'Convidado e data a definir · on-line' : ''));
      return `<div class="tl-item ${cls}"><div class="tl-date num">${it.data ? fd(it.data) + `<small>${DOW[dt(it.data).getDay()]}</small>` : '—<small>on-line</small>'}</div><div class="tl-dot"></div><div class="tl-body"><div class="tl-title"><span class="t">${esc(it.titulo)}</span>${p}</div><div class="s small muted">${sub}</div></div></div>`;
    }).join('')}</div>`;
  }

  V.agenda = () => {
    const t = turma(), encs = encontrosT();
    const pres = encs.filter((e) => e.tipo === 'presencial').length, virt = encs.length - pres;
    return `${demoBar()}<div class="pagehead"><span class="eyebrow">${esc(t.nome)}</span><h1>Agenda do curso</h1><p class="muted">${pres} encontros presenciais${t.horario ? ' (' + esc(t.horario.toLowerCase()) + ')' : ''}${virt ? ` e ${virt} encontros virtuais. Os virtuais também contam na frequência.` : '.'}</p></div>
    <div class="card">${linhaDoTempo(encs, D.eu.id)}</div>`;
  };

  V.tarefas = () => {
    const r = resumo(D.eu.id), hoje = isoHoje(), tars = tarefasT();
    const entrega = (t) => D.entregas.find((x) => x.tarefa_id === t.id && x.aluno_id === D.eu.id);
    const coment = (t) => { const x = D.notas.find((n) => n.tarefa_id === t.id && n.aluno_id === D.eu.id); return x && x.comentario; };
    const envio = tars.filter((t) => t.aceita_envio);
    const encs = encontrosT();
    return `${demoBar()}<div class="pagehead"><span class="eyebrow">Atualizado a cada nota lançada</span><h1>Tarefas e notas</h1><p class="muted">Para o certificado: média final 7,0 ou mais e presença em pelo menos 75% dos encontros (${r.minimo} de ${r.total}).</p></div>
    <div class="card"><h2>Sua nota até agora</h2>
      <div class="formula num"><div class="term"><b>${n1(r.fm)}</b><small>Formativas × 30%</small></div><span class="op">+</span><div class="term"><b>${n1(r.pi)}</b><small>Projeto Integrador × 50%</small></div><span class="op">+</span><div class="term"><b>${n1(r.pr)}</b><small>Práticas × 20%</small></div><span class="op">=</span><div class="term res"><b>${n1(r.final)}</b><small>${r.completo ? 'nota final' : 'nota parcial'}</small></div></div>
      <p class="small muted">No Projeto Integrador, as partes valem 40% e a versão final vale 60%. Enquanto falta alguma nota, a conta usa só o que já foi lançado.</p>
    </div>
    <div class="card"><h2>Entregas</h2><div class="list">${envio.map((t) => {
      const e = entrega(t), nt = r.nota(t), c = coment(t), venc = t.prazo && t.prazo < hoje;
      const st = nt != null ? pill('Corrigida · nota ' + n1(nt), 'ok') : e ? pill('Enviada · aguardando correção', 'brand') : venc ? pill('Prazo vencido em ' + fd(t.prazo), 'bad') : t.prazo ? pill('Até ' + fd(t.prazo), dias(t.prazo) <= 7 ? 'warn' : 'neutral') : '';
      return `<div class="part ${nt != null ? 'ok' : !e ? 'open' : ''}"><div class="part-n">${t.tipo === 'pi_final' ? 'F' : t.aula ? 'A' + t.aula : t.modulo || '•'}</div><div style="min-width:0;display:flex;flex-direction:column;gap:6px">
        <h3>${esc(t.titulo)}</h3><span class="small muted">${esc(t.descricao || '')}</span><div>${st}</div>
        ${c ? `<div class="feedback"><b>Devolutiva do professor:</b> ${esc(c)}</div>` : ''}
        ${e ? `<span class="small muted">Você enviou <b>${esc(e.nome_arquivo)}</b> em ${fd(e.enviado_em)}. <button class="linkbtn small" type="button" data-entrega="${t.id}">baixar</button></span>` : ''}
        ${nt == null ? `<div class="drop" data-drop="${t.id}"><span class="small"><b>${e ? 'Enviar uma nova versão' : 'Enviar o arquivo'}</b> · Word, Excel ou PDF, até 20 MB.</span><label class="btn ${e ? 'btn-ghost' : 'btn-primary'} small" style="cursor:pointer">Escolher arquivo<input type="file" hidden data-upload="${t.id}" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"></label></div>` : ''}
      </div><div class="score-col">${nt != null ? `<div class="score num">${n1(nt)}</div><div class="small muted">nota</div>` : ''}</div></div>`;
    }).join('') || '<p class="muted">Nenhuma entrega cadastrada ainda.</p>'}</div></div>
    <div class="card"><h2>Todas as notas</h2><div class="tbl-wrap"><table>
      <thead><tr><th>Avaliação</th><th>Componente</th><th>Data</th><th class="n">Nota</th></tr></thead>
      <tbody>${tars.map((t) => `<tr><td>${esc(t.titulo)}</td><td>${COMP[t.tipo]}</td><td class="num">${fd(t.prazo)}</td><td class="n">${n1(r.nota(t))}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><div class="cardhead"><h2>Frequência</h2>${pill(`${r.presentes} de ${r.realizados} realizados${r.freq != null ? ' · ' + Math.round(r.freq * 100) + '%' : ''}`, r.freq == null || r.freq >= 0.75 ? 'ok' : 'bad')}</div>
      <div class="att">${encs.map((e) => { const p = D.presencas.find((x) => x.encontro_id === e.id && x.aluno_id === D.eu.id); const rot = e.tipo === 'virtual' ? 'Virtual' : DOW[dt(e.data || '2000-01-01').getDay()];
        if (!e.data) return `<div class="fut"><b>${esc(e.titulo.replace('Encontro ', ''))}</b>data a definir</div>`;
        if (p && p.status === 'P') return `<div class="pres"><b class="num">${fd(e.data)}</b>Presente</div>`;
        if (p && p.status === 'R') return `<div class="rep"><b class="num">${fd(e.data)}</b>Reposição</div>`;
        if (p && p.status === 'F') return `<div class="falta"><b class="num">${fd(e.data)}</b>Falta</div>`;
        return `<div class="fut"><b class="num">${fd(e.data)}</b>${rot}</div>`; }).join('')}</div>
      <p class="small muted">Você ainda pode faltar a até ${Math.max(0, r.total - r.minimo - r.faltas)} encontro${r.total - r.minimo - r.faltas === 1 ? '' : 's'}.</p>
    </div>`;
  };

  V.certificado = () => {
    const r = resumo(D.eu.id), t = turma(), cert = D.certificados.find((c) => c.aluno_id === D.eu.id);
    const piFinal = tarefasT().find((x) => x.tipo === 'pi_final');
    const ck = (ok, txt, dir) => `<li><span class="ck ${ok ? 'y' : 'w'}">${ok ? '✓' : ''}</span><span>${txt}</span><span class="small muted num">${dir}</span></li>`;
    return `${demoBar()}<div class="pagehead"><span class="eyebrow">Curso de extensão · 80 horas</span><h1>Certificado</h1><p class="muted">O certificado é emitido pela ESIC Internacional, instituição credenciada pelo MEC. Assim que a ESIC enviar, ele aparece aqui para baixar.</p></div>
    <div class="split">
      <div class="cert-preview">${cert ? '' : `<span class="pill p-neutral stamp">Em curso</span>`}
        <span class="eyebrow">ESIC Internacional · Certificado de extensão</span>
        <h2 style="font-size:1.5rem">Formação de Síndicos Profissionais</h2>
        <p class="ghost">Certificamos que</p>
        <p class="cert-name">${esc(D.eu.nome)}</p>
        <p class="ghost small">concluiu o curso de extensão em Gestão Condominial e Sindicatura${t.cidade ? ', em ' + esc(t.cidade) + (parceiroDe(t) ? ', em parceria com a ' + esc(parceiroDe(t)) : '') : ''}.</p>
        <p class="small muted" style="margin-top:8px">${cert ? 'Seu certificado oficial já está disponível.' : 'Prévia ilustrativa. O documento oficial é o PDF da ESIC.'}</p>
      </div>
      <div class="card"><h2>${cert ? 'Pronto para baixar' : 'O que falta'}</h2>
        <ul class="checks">
          ${ck(r.freq != null && r.freq >= 0.75 && r.presentes >= r.minimo, 'Presença em pelo menos 75% dos encontros', `${r.presentes} de ${r.minimo}`)}
          ${ck(r.final != null && r.final >= 7, 'Média final 7,0 ou mais', n1(r.final))}
          ${ck(r.pendentes.length === 0, 'Todas as entregas enviadas', r.pendentes.length ? `faltam ${r.pendentes.length}` : 'ok')}
          ${piFinal ? ck(r.nota(piFinal) != null, 'Versão final do Projeto Integrador corrigida', 'até ' + fd(piFinal.prazo)) : ''}
        </ul>
        <p class="small muted">${t.formatura ? `Formatura em ${fdl(t.formatura)}. ` : ''}Se a média ficar abaixo de 7,0 no Projeto Integrador, você recebe o certificado de participação e tem 30 dias para reapresentar.</p>
        ${cert ? `<button class="btn btn-primary" type="button" id="baixarCert">Baixar certificado (PDF)</button>` : `<button class="btn btn-ghost" type="button" disabled style="opacity:.6;cursor:not-allowed">Baixar certificado (disponível após a formatura)</button>`}
      </div>
    </div>`;
  };

  V.perfil = () => `${demoBar()}<div class="pagehead"><span class="eyebrow">Sua conta</span><h1>Perfil e contato</h1></div>
    <div class="split">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="card"><h2>Seus dados</h2>
        <form class="pform" id="pform">
          <div class="field full"><label for="pf-nome">Nome completo (sai assim no certificado)</label><input id="pf-nome" required value="${esc(D.eu.nome)}"></div>
          <div class="field"><label for="pf-mail">E-mail de acesso</label><input id="pf-mail" value="${esc(D.eu.email)}" disabled></div>
          <div class="field"><label for="pf-cel">Celular (WhatsApp)</label><input id="pf-cel" inputmode="tel" value="${esc(D.eu.telefone || '')}" placeholder="(21) 99999-0000"></div>
          <div class="field full"><label for="pf-atua">Como você atua hoje</label><input id="pf-atua" value="${esc(D.eu.atuacao || '')}" placeholder="Ex.: síndico morador em Botafogo"></div>
          <div><button class="btn btn-primary small" type="submit">Salvar dados</button></div>
        </form>
      </div>
      <div class="card"><h2>Trocar senha</h2>
        <form class="pform" id="senhaForm"><div class="field"><label for="s1">Nova senha</label><input id="s1" type="password" minlength="6" required autocomplete="new-password"></div><div class="field"><label for="s2">Repita a nova senha</label><input id="s2" type="password" minlength="6" required autocomplete="new-password"></div><div><button class="btn btn-ghost small" type="submit">Trocar senha</button></div></form>
      </div></div>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">${contato()}</div>
    </div>`;

  function contato() {
    const c = window.CONFIG || {};
    return `<div class="card"><h2>Fale com a coordenação</h2>
      <div class="contact"><span class="avatar" style="width:56px;height:56px;font-size:1.2rem">PC</span><div><div style="font-weight:700">Prof. Paulo Cesar da Silva</div><div class="small muted">Coordenação pedagógica</div></div></div>
      <div class="list small">
        ${c.WHATSAPP ? `<div class="row"><div class="grow"><div class="t">WhatsApp da coordenação</div><div class="s">${esc(c.WHATSAPP)}</div></div><a class="btn btn-ghost small" href="https://wa.me/55${esc(c.WHATSAPP.replace(/\D/g, ''))}" target="_blank" rel="noopener">Abrir</a></div>` : ''}
        <div class="row"><div class="grow"><div class="t">E-mail do curso</div><div class="s">${esc(c.EMAIL_CURSO || 'formacaodesindicos@gmail.com')}</div></div><a class="btn btn-ghost small" href="mailto:${esc(c.EMAIL_CURSO || 'formacaodesindicos@gmail.com')}">Escrever</a></div>
        <div class="row"><div class="grow"><div class="t">Instagram</div><div class="s">@sindicopaulocesar</div></div><a class="btn btn-ghost small" href="https://www.instagram.com/sindicopaulocesar/" target="_blank" rel="noopener">Abrir</a></div>
      </div>
      <form class="msg" id="msgForm"><label for="msg">Mandar uma mensagem pela plataforma</label><textarea id="msg" required placeholder="Escreva sua dúvida sobre aulas, entregas ou frequência"></textarea><button class="btn btn-primary small" type="submit" style="align-self:flex-start">Enviar à coordenação</button></form>
      <p class="small muted">Resposta em até 2 dias úteis.</p></div>`;
  }

  // ---------- telas do professor ----------
  const seletorTurma = () => `<div class="field" style="min-width:220px"><label for="selTurma" class="small">Turma</label><select id="selTurma" class="sel">${D.turmas.map((t) => `<option value="${esc(t.id)}" ${t.id === TURMA ? 'selected' : ''}>${esc(t.nome)}${parceiroDe(t) ? ' · ' + esc(parceiroDe(t)) : ''}</option>`).join('')}</select></div>`;
  const cabecalho = (eyebrow, titulo, texto, extra) => `${demoBar()}<div class="toolbar" style="align-items:flex-end"><div class="pagehead"><span class="eyebrow">${eyebrow}</span><h1>${titulo}</h1>${texto ? `<p class="muted">${texto}</p>` : ''}</div>${extra === false ? '' : seletorTurma()}</div>`;

  V['p-painel'] = () => {
    const als = alunosT(), rs = als.map((a) => [a, resumo(a.id)]), hoje = isoHoje();
    const encs = encontrosT(), prox = encs.find((e) => e.data && e.data >= hoje);
    const mat = (D.matriculas || []).filter((m) => m.turma_id === TURMA && m.papel === 'aluno');
    const semSenha = mat.filter((m) => !als.some((a) => a.email === m.email)).length;
    const fMed = media(rs.map(([, r]) => r.freq).filter((v) => v != null)), nMed = media(rs.map(([, r]) => r.final).filter((v) => v != null));
    const risco = rs.filter(([, r]) => (r.freq != null && r.freq < 0.75) || (r.final != null && r.final < 7));
    const corrigir = D.entregas.filter((e) => tarefasT().some((t) => t.id === e.tarefa_id) && !D.notas.some((n) => n.tarefa_id === e.tarefa_id && n.aluno_id === e.aluno_id && n.nota != null));
    return `${cabecalho('Coordenação', esc(turma().nome), [parceiroDe(turma()), turma().horario].filter(Boolean).map(esc).join(' · '))}
    <div class="grid g4">
      <div class="card stat"><span class="eyebrow">Alunos</span><span class="big num">${als.length}</span><span class="small muted">${mat.length} matriculados${semSenha ? ` · ${semSenha} ainda sem senha` : ''}</span></div>
      <div class="card stat"><span class="eyebrow">Frequência média</span><span class="big num">${fMed == null ? '—' : Math.round(fMed * 100) + '%'}</span>${bar(fMed)}</div>
      <div class="card stat"><span class="eyebrow">Nota média</span><span class="big num">${n1(nMed)}</span>${bar(nMed == null ? 0 : nMed / 10, true)}</div>
      <div class="card stat"><span class="eyebrow">Para corrigir</span><span class="big num">${corrigir.length}</span><a class="linkbtn small" href="#p-notas">Abrir correções</a></div>
    </div>
    <div class="split">
      <div class="card"><div class="cardhead"><h2>Atenção</h2>${pill(risco.length + ' aluno' + (risco.length === 1 ? '' : 's'), risco.length ? 'warn' : 'ok')}</div>
        <p class="small muted">Frequência abaixo de 75% ou nota parcial abaixo de 7,0.</p>
        <div class="list">${risco.slice(0, 8).map(([a, r]) => `<a class="row go" href="#p-aluno-${esc(a.id)}"><span class="mini">${esc(ini(a.nome))}</span><div class="grow"><div class="t">${esc(a.nome)}</div><div class="s">Frequência ${r.freq == null ? '—' : Math.round(r.freq * 100) + '%'} · nota ${n1(r.final)}</div></div></a>`).join('') || '<p class="muted">Ninguém em risco agora.</p>'}</div>
      </div>
      <div class="card"><h2>Próximo encontro</h2>${prox ? `<div class="stat"><span class="big num">${fd(prox.data)}</span><span>${esc(prox.titulo)}</span><span class="small muted">${prox.aulas.map((n) => 'Aula ' + n).join(' e ') || esc(prox.detalhe || '')}</span></div><a class="btn btn-primary small" href="#p-presenca" data-enc="${prox.id}" style="align-self:flex-start">Fazer a chamada</a>` : '<p class="muted">Sem encontros futuros com data.</p>'}
        ${naoLidas() ? `<a class="btn btn-ghost small" href="#p-avisos" style="align-self:flex-start">${naoLidas()} mensagem${naoLidas() > 1 ? 's' : ''} de aluno sem ler</a>` : ''}</div>
    </div>`;
  };

  let filtroAluno = '';
  V['p-alunos'] = () => {
    const als = alunosT();
    const mat = (D.matriculas || []).filter((m) => m.turma_id === TURMA && m.papel === 'aluno');
    const pend = mat.filter((m) => !als.some((a) => a.email === m.email));
    const f = filtroAluno.toLowerCase();
    const lista = als.filter((a) => !f || a.nome.toLowerCase().includes(f) || a.email.includes(f));
    return `${cabecalho('Coordenação', 'Alunos', 'Cadastre aqui o e-mail de cada aluno matriculado. No primeiro acesso, o aluno cria a própria senha com esse e-mail.')}
    <div class="card"><h2>Matricular aluno</h2>
      <form class="cform" id="matForm"><div class="field"><label for="mNome">Nome completo</label><input id="mNome" required></div><div class="field"><label for="mEmail">E-mail</label><input id="mEmail" type="email" required></div>
      <div class="field full"><label for="mLote">Ou cole vários de uma vez (um por linha: Nome; e-mail)</label><textarea id="mLote" class="ta" rows="3" placeholder="Maria Souza; maria@email.com&#10;João Lima; joao@email.com"></textarea></div>
      <div><button class="btn btn-primary small" type="submit">Matricular na ${esc(turma().nome)}</button></div></form>
    </div>
    ${pend.length ? `<div class="card"><div class="cardhead"><h2>Ainda não criaram a senha</h2>${pill(pend.length, 'warn')}</div><p class="small muted">Mande o endereço da plataforma para eles. No primeiro acesso, basta digitar o e-mail e criar a senha.</p>
      <div class="list">${pend.map((m) => `<div class="row"><span class="mini">${esc(ini(m.nome))}</span><div class="grow"><div class="t">${esc(m.nome)}</div><div class="s">${esc(m.email)}</div></div><button class="linkbtn small" type="button" data-desmat="${esc(m.email)}">Remover</button></div>`).join('')}</div></div>` : ''}
    <div class="card"><div class="toolbar"><h2>Turma (${als.length})</h2><input class="search" id="busca" placeholder="Buscar por nome ou e-mail" value="${esc(filtroAluno)}"></div>
      <div class="tbl-wrap"><table><thead><tr><th>Aluno</th><th class="n">Progresso</th><th class="n">Frequência</th><th class="n">Nota</th><th class="n">Pendências</th></tr></thead><tbody>
      ${lista.map((a) => { const r = resumo(a.id); return `<tr class="go" data-href="#p-aluno-${esc(a.id)}"><td><div class="who-cell"><span class="mini">${esc(ini(a.nome))}</span><div><b>${esc(a.nome)}</b><div class="small muted">${esc(a.email)}</div></div></div></td><td class="n">${Math.round(r.progresso * 100)}%</td><td class="n" ${r.freq != null && r.freq < 0.75 ? 'style="color:var(--bad);font-weight:700"' : ''}>${r.freq == null ? '—' : Math.round(r.freq * 100) + '%'}</td><td class="n" ${r.final != null && r.final < 7 ? 'style="color:var(--bad);font-weight:700"' : ''}>${n1(r.final)}</td><td class="n">${r.pendentes.filter((t) => t.prazo && t.prazo < isoHoje()).length || ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Nenhum aluno com senha criada ainda.</td></tr>'}
      </tbody></table></div></div>`;
  };

  V['p-aluno'] = (id) => {
    const a = (D.alunos || []).find((x) => x.id === id); if (!a) return V['p-alunos']();
    if (a.turma_id !== TURMA) { TURMA = a.turma_id; }
    const r = resumo(a.id);
    return `${cabecalho('<a href="#p-alunos">Alunos</a> › ficha', esc(a.nome), `${esc(a.email)}${a.telefone ? ' · ' + esc(a.telefone) : ''}${a.atuacao ? ' · ' + esc(a.atuacao) : ''}`, false)}
    <div class="grid g4">
      <div class="card stat"><span class="eyebrow">Progresso</span><span class="big num">${Math.round(r.progresso * 100)}%</span>${bar(r.progresso)}</div>
      <div class="card stat"><span class="eyebrow">Frequência</span><span class="big num">${r.freq == null ? '—' : Math.round(r.freq * 100) + '%'}</span><span class="small muted">${r.presentes} presenças · ${r.faltas} faltas</span></div>
      <div class="card stat"><span class="eyebrow">Nota parcial</span><span class="big num">${n1(r.final)}</span><span class="small muted">F ${n1(r.fm)} · PI ${n1(r.pi)} · P ${n1(r.pr)}</span></div>
      <div class="card stat"><span class="eyebrow">Entregas pendentes</span><span class="big num">${r.pendentes.length}</span></div>
    </div>
    <div class="split">
      <div class="card"><h2>Notas</h2><div class="tbl-wrap"><table><thead><tr><th>Avaliação</th><th>Entrega</th><th class="n">Nota</th></tr></thead><tbody>
        ${tarefasT().map((t) => { const e = D.entregas.find((x) => x.tarefa_id === t.id && x.aluno_id === a.id); return `<tr><td>${esc(t.titulo)}</td><td>${e ? `<button class="linkbtn small" type="button" data-entrega-de="${t.id}|${esc(a.id)}">${esc(e.nome_arquivo)}</button>` : t.aceita_envio ? '<span class="muted small">não enviou</span>' : '<span class="muted small">em sala</span>'}</td><td class="n">${n1(r.nota(t))}</td></tr>`; }).join('')}
      </tbody></table></div><a class="btn btn-ghost small" href="#p-notas" style="align-self:flex-start">Lançar notas</a></div>
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        <div class="card"><h2>Presença</h2>${linhaDoTempo(encontrosT(), a.id)}</div>
        <div class="card"><h2>Acesso</h2><p class="small muted">Se o aluno esqueceu a senha, defina uma nova aqui e mande para ele. Ele pode trocar depois no perfil.</p>
          <form class="toolbar" id="resetForm" data-aluno="${esc(a.id)}"><input class="search" id="novaSenha" type="text" minlength="6" required placeholder="Nova senha (mín. 6)" value="${senhaSugerida()}"><button class="btn btn-ghost small" type="submit">Definir nova senha</button></form>
          <form class="cform" id="trocaTurma" data-email="${esc(a.email)}" data-nome="${esc(a.nome)}"><div class="field"><label for="tt" class="small">Turma do aluno</label><select id="tt" class="sel">${D.turmas.map((t) => `<option value="${esc(t.id)}" ${t.id === a.turma_id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></div><div style="align-self:end"><button class="btn btn-ghost small" type="submit">Mudar turma</button></div></form>
        </div>
      </div>
    </div>`;
  };
  const senhaSugerida = () => 'sindico' + Math.floor(1000 + Math.random() * 9000);

  let encSel = null, chamada = null;
  const codigoBloco = (e) => {
    if (e.tipo !== 'presencial') return '';
    if (!e.data) return `<div class="codigo-noite"><div><b>Código da noite</b><p class="small muted">Este encontro ainda está sem data. O código só funciona no dia do encontro: coloque a data em <a href="#p-agenda">Agenda e tarefas</a> e volte aqui.</p></div></div>`;
    const c = (D.codigos || []).find((x) => x.encontro_id === e.id), hoje = isoHoje();
    const quando = e.data === hoje ? 'hoje, entre 17h30 e 23h30' : `só no dia ${fd(e.data)}, entre 17h30 e 23h30`;
    return `<div class="codigo-noite"><div><b>Código da noite</b><p class="small muted">${c ? `Ativado. No telão aparecem um QR Code e um código de 4 números que <b>mudam a cada 40 segundos</b>, então o print que circular no WhatsApp perde a validade. O aluno aponta a câmera do celular para o QR ou digita o código na tela Início. Vale ${quando}.` : `Gere o código e mostre no telão: o aluno lê o QR Code com o celular ou digita os 4 números. Vale ${quando}.`}</p></div>
      ${c ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary small" type="button" id="telao">Mostrar QR Code no telão</button><button class="btn btn-ghost small" type="button" id="atuCh">Atualizar lista</button></div>`
        : `<button class="btn btn-primary small" type="button" id="novoCod">Gerar código da noite</button>`}</div>`;
  };
  V['p-presenca'] = () => {
    const encs = encontrosT(), hoje = isoHoje();
    if (!encs.some((e) => e.id === encSel)) { const passados = encs.filter((e) => e.data && e.data <= hoje); encSel = (passados[passados.length - 1] || encs[0] || {}).id; chamada = null; }
    const e = encs.find((x) => x.id === encSel), als = alunosT();
    if (e && !chamada) { chamada = {}; als.forEach((a) => { const p = D.presencas.find((x) => x.encontro_id === e.id && x.aluno_id === a.id); chamada[a.id] = p ? p.status : null; }); }
    const vals = Object.values(chamada || {});
    return `${cabecalho('Coordenação', 'Lista de presença', 'Toque no nome para alternar: presente, falta, reposição e sem registro. Depois clique em Salvar.')}
    ${e ? `<div class="card"><div class="toolbar"><div class="field" style="min-width:240px"><label for="enc" class="small">Encontro</label><select id="enc" class="sel">${encs.map((x) => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${x.data ? fd(x.data) : 'sem data'} · ${esc(x.titulo)}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${pill(vals.filter((v) => v === 'P' || v === 'R').length + ' presentes', 'ok')}${pill(vals.filter((v) => v === 'F').length + ' faltas', 'bad')}${pill(vals.filter((v) => !v).length + ' sem registro', 'neutral')}</div></div>
      ${codigoBloco(e)}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost small" type="button" id="todosP">Marcar todos presentes</button><button class="btn btn-ghost small" type="button" id="restoF">Quem está sem registro ganha falta</button><button class="btn btn-primary small" type="button" id="salvarCh">Salvar chamada</button></div>
      <div class="call">${als.map((a) => { const s = chamada[a.id]; return `<button type="button" class="${s || ''}" data-ch="${esc(a.id)}"><span>${esc(a.nome)}</span><b class="small">${{ P: 'Presente', F: 'Falta', R: 'Reposição' }[s] || '—'}</b></button>`; }).join('') || '<p class="muted">Nenhum aluno na turma ainda.</p>'}</div>
    </div>` : '<div class="card"><p class="muted">Esta turma ainda não tem encontros. Cadastre em Agenda e tarefas.</p></div>'}`;
  };

  let tarSel = null;
  V['p-notas'] = () => {
    const tars = tarefasT();
    if (!tars.some((t) => t.id === tarSel)) { const hoje = isoHoje(); const c = tars.filter((t) => t.prazo && t.prazo <= hoje); tarSel = (c[c.length - 1] || tars[0] || {}).id; }
    const t = tars.find((x) => x.id === tarSel), als = alunosT();
    const conta = (tt) => D.entregas.filter((e) => e.tarefa_id === tt.id && !D.notas.some((n) => n.tarefa_id === tt.id && n.aluno_id === e.aluno_id && n.nota != null)).length;
    return `${cabecalho('Coordenação', 'Notas e entregas', 'Escolha a avaliação, abra o arquivo de cada aluno e lance a nota de 0 a 10 com a devolutiva. Cada linha salva sozinha.')}
    ${t ? `<div class="card"><div class="field"><label for="tar" class="small">Avaliação</label><select id="tar" class="sel">${tars.map((x) => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.titulo)}${conta(x) ? ` · ${conta(x)} para corrigir` : ''}</option>`).join('')}</select></div>
      <p class="small muted">${TIPOS[t.tipo]}${t.prazo ? ' · prazo ' + fd(t.prazo) : ''}${t.aceita_envio ? '' : ' · feita em sala, sem envio de arquivo'}</p>
      <div class="tbl-wrap"><table class="notas-tbl"><thead><tr><th>Aluno</th>${t.aceita_envio ? '<th>Entrega</th>' : ''}<th style="width:96px">Nota</th><th>Devolutiva</th><th></th></tr></thead><tbody>
      ${als.map((a) => { const e = D.entregas.find((x) => x.tarefa_id === t.id && x.aluno_id === a.id), n = D.notas.find((x) => x.tarefa_id === t.id && x.aluno_id === a.id);
        return `<tr data-nota-row="${esc(a.id)}"><td><b>${esc(a.nome)}</b></td>${t.aceita_envio ? `<td>${e ? `<button class="linkbtn small" type="button" data-entrega-de="${t.id}|${esc(a.id)}">${esc(e.nome_arquivo)}</button><div class="small muted">${fd(e.enviado_em)}</div>` : '<span class="muted small">não enviou</span>'}</td>` : ''}
        <td><input class="nota-in" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${n && n.nota != null ? +n.nota : ''}"></td><td><textarea class="ta coment" rows="1" placeholder="Opcional">${esc(n && n.comentario || '')}</textarea></td><td><button class="btn btn-ghost small" type="button" data-salvar-nota="${esc(a.id)}">Salvar</button></td></tr>`; }).join('') || `<tr><td colspan="5" class="muted">Nenhum aluno na turma ainda.</td></tr>`}
      </tbody></table></div></div>` : '<div class="card"><p class="muted">Esta turma ainda não tem avaliações. Cadastre em Agenda e tarefas.</p></div>'}`;
  };

  V['p-materiais'] = () => {
    const hoje = isoHoje();
    return `${cabecalho('Coordenação', 'Materiais', 'Publique os arquivos de cada aula. O aluno só vê a partir da data de liberação. "Todas as turmas" serve para o Kit do Síndico, que é igual em todas as cidades.')}
    <div class="card"><h2>Enviar a pasta inteira</h2>
      <p class="small muted" style="margin-bottom:12px">Escolha a pasta <b>MATERIAIS DO CURSO - 24 aulas</b>. Cada arquivo vai sozinho para a aula da pasta onde está ("Aula 01", "Aula 02"...), para todas as turmas, liberado na noite da aula. Arquivos já publicados e os LEIA-ME são pulados, então pode enviar de novo sempre que colocar arquivos novos.</p>
      <label class="btn btn-primary small" style="cursor:pointer">Escolher a pasta<input id="muPasta" type="file" webkitdirectory directory multiple hidden></label>
      <div id="muPastaRes" style="margin-top:12px"></div></div>
    <div class="card"><h2>Publicar material avulso</h2>
      <form class="cform" id="matUp">
        <div class="field"><label for="muAula">Aula</label><select id="muAula" class="sel">${D.aulas.map((a) => `<option value="${a.numero}">Aula ${a.numero} · ${esc(a.titulo)}</option>`).join('')}</select></div>
        <div class="field"><label for="muArq">Arquivos (pode escolher vários de uma vez)</label><input id="muArq" type="file" multiple></div>
        <div class="field"><label for="muTit">Título que o aluno vê</label><input id="muTit" placeholder="Com vários arquivos, usa o nome de cada arquivo"></div>
        <div class="field"><label for="muLink">Ou um link (vídeo, pasta, site)</label><input id="muLink" type="url" placeholder="https://"></div>
        <div class="field"><label for="muData">Liberar em</label><input id="muData" type="date" value="${(noiteDa(D.aulas[0] ? D.aulas[0].numero : 1) || {}).data || hoje}"></div>
        <div class="field"><label for="muTurma">Para</label><select id="muTurma" class="sel"><option value="">Todas as turmas (Kit do Síndico)</option><option value="${esc(TURMA)}">Só a ${esc(turma().nome)} (ex.: slides)</option></select></div>
        <div class="full"><button class="btn btn-primary small" type="submit">Publicar</button> <span class="small muted" id="muInfo"></span></div>
      </form></div>
    ${D.modulos.map((m) => `<div class="card"><h2>Módulo ${esc(m.romano)} · ${esc(m.titulo)}</h2><div class="list">
      ${D.aulas.filter((a) => a.modulo === m.numero).map((a) => { const ms = materiaisDa(a.numero); const e = noiteDa(a.numero); return `<div class="row" style="align-items:flex-start"><div class="aula-n" style="min-width:64px">Aula ${a.numero}</div><div class="grow"><div class="t">${esc(a.titulo)}</div>
        ${ms.length ? ms.map((x) => `<div class="matline">${fileicon(x.caminho, x.link)}<span class="grow">${esc(x.titulo)} <span class="small muted">· ${x.turma_id ? 'só esta turma' : 'todas as turmas'} · ${x.liberado_em > hoje ? 'libera em ' + fd(x.liberado_em) : 'liberado'}</span></span><button class="linkbtn small" type="button" data-baixar="${x.id}">abrir</button><button class="linkbtn small" type="button" data-rmmat="${x.id}" style="color:var(--bad)">remover</button></div>`).join('') : `<div class="s">Nenhum material${e && e.data ? ' · aula em ' + fd(e.data) : ''}</div>`}</div></div>`; }).join('')}
    </div></div>`).join('')}`;
  };

  let editEnc = null, editTar = null;
  V['p-agenda'] = () => {
    const encs = encontrosT(), tars = tarefasT();
    const ee = encs.find((x) => x.id === editEnc) || {}, et = tars.find((x) => x.id === editTar) || {};
    return `${cabecalho('Coordenação', 'Agenda e tarefas', 'Ajuste as datas dos encontros (por exemplo, os virtuais) e as avaliações que compõem a nota.')}
    <div class="card"><h2>${ee.id ? 'Editar encontro' : 'Novo encontro'}</h2>
      <form class="cform" id="encForm" data-id="${ee.id || ''}">
        <div class="field"><label for="eTit">Título</label><input id="eTit" required value="${esc(ee.titulo || '')}" placeholder="Ex.: Encontro virtual 2"></div>
        <div class="field"><label for="eData">Data</label><input id="eData" type="date" value="${ee.data || ''}"></div>
        <div class="field"><label for="eTipo">Tipo</label><select id="eTipo" class="sel"><option value="presencial">Presencial</option><option value="virtual" ${ee.tipo === 'virtual' ? 'selected' : ''}>Virtual</option></select></div>
        <div class="field"><label for="eAulas">Aulas (números, separados por vírgula)</label><input id="eAulas" value="${(ee.aulas || []).join(', ')}" placeholder="Ex.: 11, 12"></div>
        <div class="field full"><label for="eDet">Detalhe (convidado, link, local)</label><input id="eDet" value="${esc(ee.detalhe || '')}"></div>
        <div class="full"><button class="btn btn-primary small" type="submit">${ee.id ? 'Salvar encontro' : 'Adicionar encontro'}</button>${ee.id ? ' <button class="btn btn-ghost small" type="button" id="cancEnc">Cancelar</button> <button class="linkbtn small" type="button" id="rmEnc" style="color:var(--bad)">Excluir encontro</button>' : ''}</div>
      </form>
      <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Encontro</th><th>Aulas</th><th></th></tr></thead><tbody>
        ${encs.map((x) => `<tr><td class="num">${x.data ? fd(x.data) + ' · ' + DOW[dt(x.data).getDay()] : '<span class="muted">a definir</span>'}</td><td>${esc(x.titulo)}${x.detalhe ? `<div class="small muted">${esc(x.detalhe)}</div>` : ''}</td><td>${x.aulas.join(', ')}</td><td><button class="linkbtn small" type="button" data-edit-enc="${x.id}">editar</button></td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="card"><h2>${et.id ? 'Editar avaliação' : 'Nova avaliação'}</h2>
      <form class="cform" id="tarForm" data-id="${et.id || ''}">
        <div class="field"><label for="tTit">Título</label><input id="tTit" required value="${esc(et.titulo || '')}"></div>
        <div class="field"><label for="tTipo">Entra na nota como</label><select id="tTipo" class="sel">${Object.entries(TIPOS).map(([k, l]) => `<option value="${k}" ${et.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="tMod">Módulo</label><select id="tMod" class="sel">${D.modulos.map((m) => `<option value="${m.numero}" ${et.modulo === m.numero ? 'selected' : ''}>${esc(m.romano)} · ${esc(m.titulo)}</option>`).join('')}</select></div>
        <div class="field"><label for="tAula">Aula (opcional)</label><select id="tAula" class="sel"><option value="">Nenhuma · vale para o módulo</option>${D.aulas.map((a) => `<option value="${a.numero}" ${et.aula === a.numero ? 'selected' : ''}>Aula ${a.numero} · ${esc(a.titulo)}</option>`).join('')}</select></div>
        <div class="field"><label for="tPrazo">Prazo</label><input id="tPrazo" type="date" value="${et.prazo || ''}"></div>
        <div class="field full"><label for="tDesc">Descrição para o aluno</label><input id="tDesc" value="${esc(et.descricao || '')}"></div>
        <label class="full chk"><input type="checkbox" id="tEnvio" ${et.id ? (et.aceita_envio ? 'checked' : '') : 'checked'}> O aluno envia um arquivo pela plataforma</label>
        <div class="full"><button class="btn btn-primary small" type="submit">${et.id ? 'Salvar avaliação' : 'Adicionar avaliação'}</button>${et.id ? ' <button class="btn btn-ghost small" type="button" id="cancTar">Cancelar</button> <button class="linkbtn small" type="button" id="rmTar" style="color:var(--bad)">Excluir avaliação</button>' : ''}</div>
      </form>
      <div class="tbl-wrap"><table><thead><tr><th>Avaliação</th><th>Componente</th><th>Prazo</th><th>Envio</th><th></th></tr></thead><tbody>
        ${tars.map((x) => `<tr><td>${esc(x.titulo)}</td><td>${COMP[x.tipo]}</td><td class="num">${fd(x.prazo)}</td><td>${x.aceita_envio ? 'arquivo' : 'em sala'}</td><td><button class="linkbtn small" type="button" data-edit-tar="${x.id}">editar</button></td></tr>`).join('')}
      </tbody></table></div>
      <p class="small muted">Pesos da nota final: formativas 30%, Projeto Integrador 50% (partes 40% e versão final 60%), práticas 20%.</p></div>`;
  };

  V['p-avisos'] = () => {
    const msgs = (D.mensagens || []).filter((m) => { const a = (D.alunos || []).find((x) => x.id === m.aluno_id); return a && a.turma_id === TURMA; });
    const nome = (id) => { const a = (D.alunos || []).find((x) => x.id === id); return a ? a.nome : 'Aluno'; };
    return `${cabecalho('Coordenação', 'Avisos e mensagens', 'Os avisos aparecem na página inicial de todos os alunos da turma.')}
    <div class="split">
      <div class="card"><h2>Publicar aviso</h2>
        <form class="cform" id="avForm" style="grid-template-columns:minmax(0,1fr)"><div class="field"><label for="avTit">Título</label><input id="avTit" required></div><div class="field"><label for="avTxt">Texto</label><textarea id="avTxt" class="ta" rows="3"></textarea></div>
        <div class="field"><label for="avPara">Para</label><select id="avPara" class="sel"><option value="${esc(TURMA)}">Só a ${esc(turma().nome)}</option><option value="">Todas as turmas</option></select></div><div><button class="btn btn-primary small" type="submit">Publicar aviso</button></div></form>
        <div class="list">${D.avisos.filter((a) => !a.turma_id || a.turma_id === TURMA).map((a) => `<div class="row"><div class="grow"><div class="t">${esc(a.titulo)}</div><div class="s">${esc(a.texto || '')} · ${fd(a.criado_em)}${a.turma_id ? '' : ' · todas as turmas'}</div></div><button class="linkbtn small" type="button" data-rmav="${a.id}" style="color:var(--bad)">remover</button></div>`).join('')}</div>
      </div>
      <div class="card"><h2>Mensagens dos alunos</h2><div class="list">${msgs.map((m) => `<div class="row" style="align-items:flex-start"><span class="mini">${esc(ini(nome(m.aluno_id)))}</span><div class="grow"><div class="t">${esc(nome(m.aluno_id))} ${m.lida ? '' : pill('nova', 'warn')}</div><div>${esc(m.texto)}</div><div class="s">${fd(m.criado_em)}</div></div>${m.lida ? '' : `<button class="linkbtn small" type="button" data-lida="${m.id}">marcar lida</button>`}</div>`).join('') || '<p class="muted">Nenhuma mensagem.</p>'}</div>
        <p class="small muted">Responda pelo e-mail ou WhatsApp do aluno (estão na ficha dele).</p></div>
    </div>`;
  };

  V['p-certificados'] = () => {
    const rs = alunosT().map((a) => [a, resumo(a.id)]);
    const apto = ([, r]) => r.freq != null && r.freq >= 0.75 && r.final != null && r.final >= 7;
    return `${cabecalho('Coordenação', 'Certificados', 'A plataforma mostra quem está apto. Exporte a lista para a ESIC e, quando ela devolver os PDFs, carregue o de cada aluno. Ele aparece na hora para o aluno baixar.')}
    <div class="card"><div class="toolbar"><div style="display:flex;gap:8px;flex-wrap:wrap">${pill(rs.filter(apto).length + ' aptos até agora', 'ok')}${pill(rs.filter((x) => !apto(x)).length + ' ainda não', 'neutral')}</div><button class="btn btn-ghost small" type="button" id="exportar">Baixar lista para a ESIC (planilha)</button></div>
      <div class="tbl-wrap"><table><thead><tr><th>Aluno</th><th class="n">Frequência</th><th class="n">Nota</th><th>Situação</th><th>Certificado</th></tr></thead><tbody>
      ${rs.map(([a, r]) => { const c = D.certificados.find((x) => x.aluno_id === a.id); return `<tr><td><b>${esc(a.nome)}</b></td><td class="n">${r.freq == null ? '—' : Math.round(r.freq * 100) + '%'}</td><td class="n">${n1(r.final)}</td><td>${apto([a, r]) ? pill('Apto', 'ok') : pill('Ainda não', 'neutral')}</td><td>${c ? `${pill('Enviado ' + fd(c.enviado_em), 'brand')} ` : ''}<label class="linkbtn small" style="cursor:pointer">${c ? 'trocar PDF' : 'carregar PDF'}<input type="file" accept="application/pdf" hidden data-cert="${esc(a.id)}"></label></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  };

  V['p-mais'] = () => `${demoBar()}<div class="pagehead"><span class="eyebrow">Coordenação</span><h1>Mais opções</h1></div><div class="grid g2">${NAV_PROF.map(([k, l, i]) => `<a class="card tile-big" href="#${k}">${svg(i)}<b>${l}</b></a>`).join('')}</div>`;

  // ---------- desenho da fachada (decoração do topo) ----------
  function fachada(n) { let s = 3, h = ''; for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; const r = s / 233280; h += `<i class="${r > 0.82 ? 'on' : r > 0.62 ? 'dim' : ''}"></i>`; } return h; }

  // ---------- roteamento ----------
  function aulasDaTurma() { if (!D) return; D.aulasBase = D.aulasBase || D.aulas; D.aulas = D.aulasBase.map((a) => ({ ...a, ...((a.por_turma || {})[TURMA] || {}) })); }
  async function recarregar() { D = await API.carregar(); if (!ehProf()) TURMA = D.eu.turma_id; else if (!D.turmas.some((t) => t.id === TURMA)) TURMA = (D.turmas.find((t) => t.id === 'rj-2027') || D.turmas[0] || {}).id; aulasDaTurma(); }
  function render() {
    if (!D) return;
    let h = location.hash.slice(1) || (ehProf() ? 'p-painel' : 'inicio');
    if (h === 'sair') { sair(); return; }
    const prof = ehProf();
    if (prof && !h.startsWith('p-')) h = 'p-painel';
    if (!prof && h.startsWith('p-')) h = 'inicio';
    let html;
    const m = h.match(/^aula-(\d+)$/), ma = h.match(/^p-aluno-(.+)$/);
    if (m) html = V.aula(+m[1]);
    else if (ma) html = V['p-aluno'](decodeURIComponent(ma[1]));
    else html = (V[h] || V[prof ? 'p-painel' : 'inicio'])();
    montarCasca();
    $('#view').innerHTML = html;
    const base = m ? 'aulas' : ma ? 'p-alunos' : h;
    $$('[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === base ? 'page' : 'false'));
    ligar();
    document.title = (D.eu.nome ? '' : '') + 'Área do Aluno · Formação de Síndicos';
  }
  async function atualizar(msg) { await recarregar(); const y = window.scrollY; render(); window.scrollTo(0, y); if (msg) toast(msg); }

  async function baixar(bucket, caminho, nome) {
    if (API.demo) { toast('Na prévia os arquivos não são baixados. No site real, o arquivo abre aqui.'); return; }
    await tentar(async () => { const url = await API.urlArquivo(bucket, caminho, nome); window.open(url, '_blank', 'noopener'); });
  }

  // ---------- eventos ----------
  function ligar() {
    const on = (sel, ev, fn) => $$(sel).forEach((el) => el.addEventListener(ev, fn));
    on('[data-mod]', 'click', (e) => { const n = +e.currentTarget.dataset.mod; abertos.has(n) ? abertos.delete(n) : abertos.add(n); const y = scrollY; render(); scrollTo(0, y); });
    on('[data-baixar]', 'click', (e) => { const x = D.materiais.find((m) => m.id === +e.currentTarget.dataset.baixar); if (x.link) window.open(x.link, '_blank', 'noopener'); else baixar('materiais', x.caminho); });
    const c = $('#concluir'); if (c) c.onclick = async () => { const n = +location.hash.split('-')[1]; if (await tentar(() => API.marcarConcluida(n, c.dataset.on === '1'))) atualizar(c.dataset.on === '1' ? 'Aula marcada como concluída.' : 'Aula desmarcada.'); };
    on('[data-upload]', 'change', async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 20 * 1048576) { toast('O arquivo passa de 20 MB. Tente um PDF menor.', true); return; } const lab = e.target.parentElement; lab.textContent = 'Enviando…'; if (await tentar(() => API.enviarEntrega(+e.target.dataset.upload, f))) atualizar('Arquivo enviado. O professor vai corrigir e a nota aparece aqui.'); else render(); });
    on('[data-drop]', 'dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); });
    on('[data-drop]', 'dragleave', (e) => e.currentTarget.classList.remove('over'));
    on('[data-drop]', 'drop', async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && await tentar(() => API.enviarEntrega(+e.currentTarget.dataset.drop, f))) atualizar('Arquivo enviado.'); });
    on('[data-entrega]', 'click', (e) => { const x = D.entregas.find((y) => y.tarefa_id === +e.currentTarget.dataset.entrega && y.aluno_id === D.eu.id); baixar('entregas', x.caminho, x.nome_arquivo); });
    on('[data-entrega-de]', 'click', (e) => { const [t, a] = e.currentTarget.dataset.entregaDe.split('|'); const x = D.entregas.find((y) => y.tarefa_id === +t && y.aluno_id === a); baixar('entregas', x.caminho, x.nome_arquivo); });
    const bc = $('#baixarCert'); if (bc) bc.onclick = () => { const x = D.certificados.find((c2) => c2.aluno_id === D.eu.id); baixar('certificados', x.caminho, 'Certificado ' + D.eu.nome + '.pdf'); };
    const pf = $('#pform'); if (pf) pf.onsubmit = async (e) => { e.preventDefault(); if (await tentar(() => API.salvarPerfil({ nome: $('#pf-nome').value.trim(), telefone: $('#pf-cel').value.trim() || null, atuacao: $('#pf-atua').value.trim() || null }))) atualizar('Dados salvos.'); };
    const sf = $('#senhaForm'); if (sf) sf.onsubmit = async (e) => { e.preventDefault(); if ($('#s1').value !== $('#s2').value) { toast('As duas senhas não são iguais.', true); return; } if (await tentar(() => API.trocarSenha($('#s1').value), 'Senha trocada.')) sf.reset(); };
    const mf = $('#msgForm'); if (mf) mf.onsubmit = async (e) => { e.preventDefault(); if (await tentar(() => API.enviarMensagem($('#msg').value.trim()), 'Mensagem enviada à coordenação.')) mf.reset(); };

    // professor
    const st = $('#selTurma'); if (st) st.onchange = () => { TURMA = st.value; try { localStorage.setItem('turma', TURMA); } catch (e) { /* ok */ } aulasDaTurma(); encSel = tarSel = editEnc = editTar = null; chamada = null; render(); };
    on('tr.go', 'click', (e) => { location.hash = e.currentTarget.dataset.href; });
    const bu = $('#busca'); if (bu) bu.oninput = () => { filtroAluno = bu.value; const pos = bu.selectionStart; render(); const b2 = $('#busca'); b2.focus(); b2.setSelectionRange(pos, pos); };
    const mt = $('#matForm'); if (mt) mt.onsubmit = async (e) => {
      e.preventDefault();
      const lote = $('#mLote').value.trim(); let itens = [];
      if (lote) itens = lote.split('\n').map((l) => l.split(/[;\t,]/).map((s) => s.trim())).filter((p) => p.length >= 2 && p[1].includes('@')).map(([nome, email]) => ({ nome, email }));
      if ($('#mNome').value.trim() && $('#mEmail').value.trim()) itens.push({ nome: $('#mNome').value.trim(), email: $('#mEmail').value.trim() });
      if (!itens.length) { toast('Preencha nome e e-mail.', true); return; }
      if (await tentar(async () => { for (const it of itens) await API.matricular({ ...it, turma_id: TURMA, papel: 'aluno' }); })) atualizar(itens.length > 1 ? `${itens.length} alunos matriculados.` : 'Aluno matriculado.');
    };
    $$('#matForm input[required]').forEach((i) => { i.required = false; });
    on('[data-desmat]', 'click', async (e) => { if (confirm('Remover esta matrícula?') && await tentar(() => API.removerMatricula(e.currentTarget.dataset.desmat))) atualizar('Matrícula removida.'); });
    const rf = $('#resetForm'); if (rf) rf.onsubmit = async (e) => { e.preventDefault(); const s = $('#novaSenha').value.trim(); if (await tentar(() => API.redefinirSenha(rf.dataset.aluno, s))) toast(`Nova senha definida: ${s}. Mande para o aluno.`); };
    const tt = $('#trocaTurma'); if (tt) tt.onsubmit = async (e) => { e.preventDefault(); if (await tentar(() => API.matricular({ email: tt.dataset.email, nome: tt.dataset.nome, turma_id: $('#tt').value, papel: 'aluno' }))) atualizar('Turma alterada.'); };
    const en = $('#enc'); if (en) en.onchange = () => { encSel = +en.value; chamada = null; render(); };
    on('[data-ch]', 'click', (e) => { const id = e.currentTarget.dataset.ch, ordem = [null, 'P', 'F', 'R']; chamada[id] = ordem[(ordem.indexOf(chamada[id]) + 1) % 4]; const y = scrollY; render(); scrollTo(0, y); });
    const tp = $('#todosP'); if (tp) tp.onclick = () => { Object.keys(chamada).forEach((k) => { chamada[k] = 'P'; }); render(); };
    const rF = $('#restoF'); if (rF) rF.onclick = () => { Object.keys(chamada).forEach((k) => { if (!chamada[k]) chamada[k] = 'F'; }); render(); };
    const prf = $('#presForm'); if (prf) prf.onsubmit = async (ev) => { ev.preventDefault(); const c = $('#presCod').value.replace(/\D/g, ''); if (c.length !== 4) { toast('Digite os 4 números do código.', true); return; } if (await tentar(() => API.marcarPresenca(c))) atualizar('Presença marcada. Bom encontro!'); };
    const nc = $('#novoCod'); if (nc) nc.onclick = async () => { if (await tentar(() => API.gerarCodigo(encSel))) { await atualizar('Código ativado.'); abrirTelao(encSel); } };
    const tl = $('#telao'); if (tl) tl.onclick = () => abrirTelao(encSel);
    const ac = $('#atuCh'); if (ac) ac.onclick = () => { chamada = null; atualizar('Lista atualizada.'); };
    const sc = $('#salvarCh'); if (sc) sc.onclick = async () => { if (await tentar(() => API.salvarPresencas(encSel, chamada))) { chamada = null; atualizar('Chamada salva.'); } };
    const ta = $('#tar'); if (ta) ta.onchange = () => { tarSel = +ta.value; render(); };
    on('[data-salvar-nota]', 'click', async (e) => {
      const tr = e.currentTarget.closest('tr'), v = tr.querySelector('.nota-in').value.replace(',', '.'), com = tr.querySelector('.coment').value.trim();
      const nota = v === '' ? null : +v; if (nota != null && (isNaN(nota) || nota < 0 || nota > 10)) { toast('A nota vai de 0 a 10.', true); return; }
      if (await tentar(() => API.salvarNota(tarSel, e.currentTarget.dataset.salvarNota, nota, com))) atualizar('Nota salva.');
    });
    on('.nota-in', 'keydown', (e) => { if (e.key === 'Enter') e.currentTarget.closest('tr').querySelector('[data-salvar-nota]').click(); });
    const mu = $('#matUp'); if (mu) mu.onsubmit = async (e) => {
      e.preventDefault(); const fs = [...$('#muArq').files], link = $('#muLink').value.trim();
      if (!fs.length && !link) { toast('Escolha um ou mais arquivos, ou cole um link.', true); return; }
      const base = { aula: +$('#muAula').value, liberado_em: $('#muData').value || isoHoje(), turma_id: $('#muTurma').value || null };
      const titulo = (f) => (fs.length === 1 && $('#muTit').value.trim()) || nomeBonito(f.name);
      if (!fs.length && !$('#muTit').value.trim()) { toast('Escreva um título para o link.', true); return; }
      const ok = await tentar(async () => {
        if (link) await API.addMaterial({ ...base, titulo: $('#muTit').value.trim(), link });
        for (let i = 0; i < fs.length; i++) { $('#muInfo').textContent = `Enviando ${i + 1} de ${fs.length}…`; await API.addMaterial({ ...base, titulo: titulo(fs[i]), file: fs[i] }); }
      });
      if (ok) atualizar(fs.length > 1 ? `${fs.length} materiais publicados.` : 'Material publicado.'); else $('#muInfo').textContent = '';
    };
    const mp = $('#muPasta'); if (mp) mp.onchange = () => {
      const lista = [];
      [...mp.files].forEach((f) => {
        const partes = (f.webkitRelativePath || f.name).split('/'); const nome = partes[partes.length - 1];
        if (nome.startsWith('.') || /^leia-me/i.test(nome) || /^~\$/.test(nome)) return;
        let aula = null; partes.slice(0, -1).forEach((p) => { const m = p.match(/^aula\s*0*(\d+)/i); if (m) aula = +m[1]; });
        if (!aula || !D.aulas.some((a) => a.numero === aula)) return;
        const titulo = nomeBonito(nome); const ja = D.materiais.some((x) => x.aula === aula && !x.turma_id && x.titulo === titulo);
        lista.push({ f, aula, titulo, ja });
      });
      const res = $('#muPastaRes');
      if (!lista.length) { res.innerHTML = `<p class="small muted">Não achei arquivos dentro de pastas "Aula 01", "Aula 02"... Confira se escolheu a pasta certa.</p>`; mp.value = ''; return; }
      const nJa = lista.filter((x) => x.ja).length;
      const desenhar = () => {
        const subst = !!($('#muSubst') || {}).checked;
        const envio = subst ? lista : lista.filter((x) => !x.ja), aulas = [...new Set(envio.map((x) => x.aula))].sort((a, b) => a - b);
        $('#muPastaLista').innerHTML = envio.length ? `<p class="small"><b>${envio.length} arquivo${envio.length > 1 ? 's' : ''}</b> para ${aulas.length === 1 ? 'a aula ' + aulas[0] : 'as aulas ' + aulas.join(', ')}${!subst && nJa ? ` · ${nJa} já publicado${nJa > 1 ? 's' : ''} (vou pular)` : ''}.</p>
          <ul class="small muted" style="margin:6px 0 12px;padding-left:18px">${envio.map((x) => `<li>Aula ${x.aula} · ${esc(x.titulo)}${x.ja ? ' <b>(substitui o antigo)</b>' : ''}</li>`).join('')}</ul>` : '<p class="small muted">Todos os arquivos dessa pasta já estão publicados. Para trocar pelas versões novas, marque a opção acima.</p>';
        $('#muPastaOk').hidden = !envio.length; return envio;
      };
      res.innerHTML = `${nJa ? `<label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;cursor:pointer"><input type="checkbox" id="muSubst"> Substituir os ${nJa} que já estão publicados pela versão desta pasta</label>` : ''}
        <div id="muPastaLista"></div>
        <button class="btn btn-primary small" type="button" id="muPastaOk">Publicar todos</button> <span class="small muted" id="muPastaInfo"></span>`;
      if ($('#muSubst')) $('#muSubst').onchange = desenhar;
      desenhar();
      $('#muPastaOk').onclick = async () => {
        const envio = desenhar(); if (!envio.length) return;
        $('#muPastaOk').disabled = true;
        const ok = await tentar(async () => { await API.conferirProfessor(); for (let i = 0; i < envio.length; i++) { const x = envio[i]; $('#muPastaInfo').textContent = `Enviando ${i + 1} de ${envio.length}…`;
          if (x.ja) { for (const velho of D.materiais.filter((m) => m.aula === x.aula && !m.turma_id && m.titulo === x.titulo)) await API.removerMaterial(velho); }
          await API.addMaterial({ aula: x.aula, turma_id: null, titulo: x.titulo, file: x.f, liberado_em: (noiteDa(x.aula) || {}).data || isoHoje() }); } });
        if (ok) atualizar(`${envio.length} materiais publicados nas aulas certas.`); else { $('#muPastaOk').disabled = false; $('#muPastaInfo').textContent = ''; }
      };
    };
    const ma = $('#muArq'); if (ma) ma.onchange = () => { const f = ma.files[0]; $('#muTit').value = ma.files.length === 1 ? nomeBonito(f.name) : ''; $('#muTit').disabled = ma.files.length > 1; };
    const mA = $('#muAula'); if (mA) mA.onchange = () => { const e = noiteDa(+mA.value); if (e && e.data) $('#muData').value = e.data; };
    on('[data-rmmat]', 'click', async (e) => { const x = D.materiais.find((m) => m.id === +e.currentTarget.dataset.rmmat); if (confirm(`Remover "${x.titulo}"?`) && await tentar(() => API.removerMaterial(x))) atualizar('Material removido.'); });
    on('[data-edit-enc]', 'click', (e) => { editEnc = +e.currentTarget.dataset.editEnc; render(); $('#encForm').scrollIntoView({ block: 'center' }); });
    on('[data-edit-tar]', 'click', (e) => { editTar = +e.currentTarget.dataset.editTar; render(); $('#tarForm').scrollIntoView({ block: 'center' }); });
    const ce = $('#cancEnc'); if (ce) ce.onclick = () => { editEnc = null; render(); };
    const ct = $('#cancTar'); if (ct) ct.onclick = () => { editTar = null; render(); };
    const re = $('#rmEnc'); if (re) re.onclick = async () => { if (confirm('Excluir este encontro e a chamada dele?') && await tentar(() => API.removerEncontro(editEnc))) { editEnc = null; atualizar('Encontro excluído.'); } };
    const rt = $('#rmTar'); if (rt) rt.onclick = async () => { if (confirm('Excluir esta avaliação, as entregas e as notas dela?') && await tentar(() => API.removerTarefa(editTar))) { editTar = null; atualizar('Avaliação excluída.'); } };
    const ef = $('#encForm'); if (ef) ef.onsubmit = async (e) => { e.preventDefault(); const obj = { turma_id: TURMA, titulo: $('#eTit').value.trim(), data: $('#eData').value || null, tipo: $('#eTipo').value, aulas: $('#eAulas').value.split(/[,\s]+/).map(Number).filter((n) => n > 0), detalhe: $('#eDet').value.trim() || null }; if (ef.dataset.id) obj.id = +ef.dataset.id; if (await tentar(() => API.salvarEncontro(obj))) { editEnc = null; atualizar('Encontro salvo.'); } };
    const tf = $('#tarForm'); if (tf) tf.onsubmit = async (e) => { e.preventDefault(); const obj = { turma_id: TURMA, titulo: $('#tTit').value.trim(), tipo: $('#tTipo').value, modulo: +$('#tMod').value, prazo: $('#tPrazo').value || null, descricao: $('#tDesc').value.trim() || null, aceita_envio: $('#tEnvio').checked }; if ($('#tAula').value || (tf.dataset.id && (tarefasT().find((x) => x.id === +tf.dataset.id) || {}).aula)) obj.aula = $('#tAula').value ? +$('#tAula').value : null; if (tf.dataset.id) obj.id = +tf.dataset.id; else obj.ordem = tarefasT().length + 1; if (await tentar(() => API.salvarTarefa(obj))) { editTar = null; atualizar('Avaliação salva.'); } };
    const af = $('#avForm'); if (af) af.onsubmit = async (e) => { e.preventDefault(); if (await tentar(() => API.salvarAviso({ turma_id: $('#avPara').value || null, titulo: $('#avTit').value.trim(), texto: $('#avTxt').value.trim() || null }))) atualizar('Aviso publicado.'); };
    on('[data-rmav]', 'click', async (e) => { if (confirm('Remover este aviso?') && await tentar(() => API.removerAviso(+e.currentTarget.dataset.rmav))) atualizar('Aviso removido.'); });
    on('[data-lida]', 'click', async (e) => { if (await tentar(() => API.marcarLida(+e.currentTarget.dataset.lida))) atualizar(); });
    on('[data-cert]', 'change', async (e) => { const f = e.target.files[0]; if (f && await tentar(() => API.enviarCertificado(e.target.dataset.cert, f))) atualizar('Certificado carregado. O aluno já pode baixar.'); });
    const ex = $('#exportar'); if (ex) ex.onclick = exportarESIC;
    on('[data-enc]', 'click', (e) => { encSel = +e.currentTarget.dataset.enc; chamada = null; });
  }

  function exportarESIC() {
    const linhas = [['Nome', 'E-mail', 'Telefone', 'Turma', 'Parceiro', 'Frequência (%)', 'Nota final', 'Situação']];
    alunosT().forEach((a) => { const r = resumo(a.id); const ok = r.freq != null && r.freq >= 0.75 && r.final != null && r.final >= 7; linhas.push([a.nome, a.email, a.telefone || '', turma().nome, turma().parceiro, r.freq == null ? '' : Math.round(r.freq * 100), r.final == null ? '' : r.final.toFixed(1).replace('.', ','), ok ? 'Apto' : 'Não apto']); });
    const csv = '﻿' + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `certificados-${TURMA}.csv`; a.click();
  }

  // ---------- entrada ----------
  let modoEntrada = 'entrar';
  const CIDADES = { 'rj-2027': 'Rio de Janeiro · Centrimóveis', 'sp-2027': 'São Paulo · Condo Hub', 'cwb-2027': 'Curitiba', 'poa-2027': 'Porto Alegre' };
  const cidadeDe = (id) => { const c = (CIDADES[id] || id || '').split(' · ')[0]; return (/^Rio /.test(c) ? 'do ' : 'de ') + c; };
  function telaEntrada() {
    $('#app').hidden = true; $('#login').hidden = false;
    $('#loginArt .facade').innerHTML = fachada(72);
    $('#demoEntrar').hidden = !API.demo;
    const cid = CIDADES[new URLSearchParams(location.search).get('turma')];
    $('#lgCidade').textContent = cid ? 'Área do aluno · ' + cid : 'Área do aluno';
    trocarModo('entrar');
  }
  function trocarModo(m) {
    modoEntrada = m;
    $('#lgTitulo').textContent = m === 'primeiro' ? 'Primeiro acesso' : 'Entrar na plataforma';
    $('#lgTexto').textContent = m === 'primeiro' ? 'Use o e-mail que você informou na matrícula e crie a sua senha (mínimo de 6 caracteres).' : 'Use o e-mail da matrícula e a sua senha.';
    $('#lgRepetir').hidden = m !== 'primeiro';
    $('#lgSenha2').required = m === 'primeiro';
    $('#lgSenha').autocomplete = m === 'primeiro' ? 'new-password' : 'current-password';
    $('#lgBotao').textContent = m === 'primeiro' ? 'Criar senha e entrar' : 'Entrar';
    $('#lgTroca').innerHTML = m === 'primeiro' ? 'Já tem senha? <button type="button" class="linkbtn" data-modo="entrar">Entrar</button>' : 'Primeira vez aqui? <button type="button" class="linkbtn" data-modo="primeiro">Criar minha senha</button>';
    $$('[data-modo]').forEach((b) => { b.onclick = () => trocarModo(b.dataset.modo); });
    $('#lgErro').textContent = '';
  }
  async function entrarSubmit(e) {
    e.preventDefault();
    const email = $('#lgEmail').value, senha = $('#lgSenha').value, btn = $('#lgBotao');
    $('#lgErro').textContent = '';
    if (modoEntrada === 'primeiro' && senha !== $('#lgSenha2').value) { $('#lgErro').textContent = 'As duas senhas não são iguais.'; return; }
    btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Aguarde…';
    try {
      if (modoEntrada === 'primeiro') await API.criarSenha(email, senha);
      else {
        try { await API.entrar(email, senha); } catch (err) {
          if (/Invalid login/i.test(err.message || '') && !API.demo) {
            const s = await API.situacaoEmail(email).catch(() => null);
            if (s === 'primeiro_acesso') { trocarModo('primeiro'); $('#lgErro').textContent = 'Este é o seu primeiro acesso. Crie a sua senha abaixo.'; return; }
            if (s === 'nao_matriculado') throw new Error('EMAIL_NAO_MATRICULADO');
          }
          throw err;
        }
      }
      await iniciar();
    } catch (err) { console.error(err); $('#lgErro').textContent = API.erroAmigavel(err); }
    finally { btn.disabled = false; btn.textContent = txt === 'Aguarde…' ? 'Entrar' : txt; }
  }
  async function sair() { await API.sair(); D = null; history.replaceState(null, '', location.pathname); telaEntrada(); }

  function carregarQR() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((ok, erro) => { const sc = document.createElement('script'); sc.src = 'js/qrcode.js?v=1'; sc.onload = ok; sc.onerror = erro; document.head.appendChild(sc); });
  }
  function abrirTelao(encontroId) {
    const d = document.createElement('div'); d.className = 'telao';
    d.innerHTML = `<span class="tl-top">Presença de hoje · aponte a câmera do celular</span><div class="tl-qr" id="tlQr"></div><b class="num" id="tlCod">····</b><span class="tl-sub">ou digite o código na tela Início da plataforma · muda em <span id="tlResta">40</span>s</span><button type="button" class="tl-fechar">Fechar</button>`;
    document.body.appendChild(d); if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
    let vivo = true, t1 = null, t2 = null, resta = 40;
    const fechar = () => { vivo = false; clearTimeout(t1); clearInterval(t2); d.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); document.removeEventListener('keydown', esc1); };
    const esc1 = (ev) => { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc1); d.querySelector('.tl-fechar').onclick = fechar;
    t2 = setInterval(() => { resta = Math.max(0, resta - 1); const r = d.querySelector('#tlResta'); if (r) r.textContent = resta; }, 1000);
    const ciclo = async () => {
      if (!vivo) return;
      try {
        const [{ codigo, resta: r }] = await Promise.all([API.codigoAtual(encontroId), carregarQR()]);
        if (!vivo) return;
        const url = `${location.origin}${location.pathname}#presenca=${codigo}`;
        const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
        d.querySelector('#tlQr').innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
        d.querySelector('#tlCod').textContent = codigo; resta = r; d.querySelector('#tlResta').textContent = r;
        t1 = setTimeout(ciclo, (r + 1) * 1000);
      } catch (e) { console.error(e); toast(API.erroAmigavel(e), true); t1 = setTimeout(ciclo, 5000); }
    };
    ciclo();
  }
  async function presencaPendente() {
    let c = null; try { c = sessionStorage.getItem('presPend'); sessionStorage.removeItem('presPend'); } catch (e) { /* sem armazenamento */ }
    if (!c || !D || ehProf()) return;
    if (await tentar(() => API.marcarPresenca(c))) { location.hash = 'inicio'; await atualizar('Presença marcada pelo QR Code. Bom encontro!'); }
  }
  { const m = location.hash.match(/^#presenca=(\d{4})$/); if (m) { try { sessionStorage.setItem('presPend', m[1]); } catch (e) { /* ok */ } history.replaceState(null, '', location.pathname + location.search); } }

  async function iniciar() {
    try { await recarregar(); } catch (e) { console.error(e); await API.sair(); telaEntrada(); $('#lgErro').textContent = API.erroAmigavel(e); return; }
    const pedida = new URLSearchParams(location.search).get('turma'), minha = D.eu.turma_id;
    if (pedida && !ehProf() && pedida !== minha) {
      D = null; await API.sair(); telaEntrada();
      $('#lgErro').innerHTML = `Você não está matriculado na turma ${esc(cidadeDe(pedida))}.${minha ? ` A sua turma é a ${esc(cidadeDe(minha))}: <a href="entrar.html?turma=${encodeURIComponent(minha)}">entrar pela turma ${esc(cidadeDe(minha))}</a>.` : ' Fale com a coordenação.'}`;
      return;
    }
    $('#login').hidden = true; $('#app').hidden = false; render();
    presencaPendente();
  }

  window.addEventListener('hashchange', () => { if (D) { render(); window.scrollTo(0, 0); } });
  document.addEventListener('DOMContentLoaded', async () => {
    $('#loginForm').addEventListener('submit', entrarSubmit);
    $$('[data-demo]').forEach((b) => { b.onclick = async () => { await API.entrarComo(b.dataset.demo); history.replaceState(null, '', location.pathname + location.search); await iniciar(); }; });
    try { if (await API.sessao()) { await iniciar(); return; } } catch (e) { console.error(e); }
    telaEntrada();
  });
})();
