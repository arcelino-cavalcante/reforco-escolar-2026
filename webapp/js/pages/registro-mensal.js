/**
 * 📊 REGISTRO MENSAL / BIMESTRAL — Prof. Reforço
 */

import {
  listarEstudantes, obterRegentePorTurmaEArea, obterMediaDiariaEstudanteBimestre,
  listarConsolidadosMensais,
  obterResumoFrequenciaEstudanteBimestre, obterConsolidadoTrimestre,
  criarConsolidadoMensal, atualizarConsolidadoMensal,
  ESCALA_COMPREENSAO, ESCALA_NOTA_10
} from '../db.js';

const NIVEIS_ESCRITA_BASE = [
  'Pré-silábico',
  'Silábico (sem valor sonoro)',
  'Silábico (com valor sonoro)',
  'Silábico-Alfabético',
  'Alfabético',
  'Ortográfico'
];

const NIVEIS_LEITURA_BASE = [
  'Pré-leitor',
  'Leitor inicial (decodificador)',
  'Leitor fluente',
  'Leitor compreensivo (ler para aprender)'
];

export async function renderRegistroMensal(container, session) {
  if (session.perfil !== 'reforco') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`; return;
  }

  let dataSelecionada = new Date().toISOString().split('T')[0];
  let bimestreSelecionado = "I";
  let estudanteSelecionado = "";
  
  let meusEstudantes = [];
  let regenteMatch = null;
  let regExistente = null;
  let mediaDiaria = null;
  let resumoFrequencia = null;
  let resumoQuantitativo = null;

  container.innerHTML = loadingHTML();
  await loadBaseData();
  renderPage();

  async function loadBaseData() {
    try {
      const todosEstudantes = await listarEstudantes();
      meusEstudantes = todosEstudantes.filter(e => (session.turmasIds || []).includes(String(e.turma_id)));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStudentData() {
    if (!estudanteSelecionado) {
      regExistente = null; mediaDiaria = null; regenteMatch = null; resumoFrequencia = null; return;
    }
    const eData = meusEstudantes.find(x => x.id === estudanteSelecionado);
    if (!eData) return;
    
    regenteMatch = await obterRegentePorTurmaEArea(eData.turma_id, session.profArea);
    regExistente = await obterConsolidadoTrimestre(estudanteSelecionado, session.profId, bimestreSelecionado);
    mediaDiaria = await obterMediaDiariaEstudanteBimestre(estudanteSelecionado, session.profId, bimestreSelecionado);
    resumoFrequencia = await obterResumoFrequenciaEstudanteBimestre(estudanteSelecionado, session.profId, bimestreSelecionado);
  }

  async function loadResumoQuantitativo() {
    try {
      const todos = await listarConsolidadosMensais();
      const anoSel = Number(String(dataSelecionada || '').split('-')[0]) || new Date().getFullYear();
      const idsMeusAlunos = new Set(meusEstudantes.map((e) => String(e.id)));
      const alunoMap = {};
      meusEstudantes.forEach((e) => { alunoMap[String(e.id)] = e; });

      const filtrados = (todos || []).filter((r) => {
        const bOk = String(r?.bimestre || '') === String(bimestreSelecionado);
        const anoReg = Number(String(r?.data_registro || '').split('-')[0]) || 0;
        const alunoOk = idsMeusAlunos.has(String(r?.estudante_id || ''));
        return bOk && anoReg === anoSel && alunoOk;
      });

      resumoQuantitativo = calcularResumoQuantitativoAutomatico(filtrados, alunoMap);
    } catch (e) {
      console.error('Erro ao calcular consolidado quantitativo automático:', e);
      resumoQuantitativo = null;
    }
  }

  async function renderPage() {
    await loadStudentData();
    await loadResumoQuantitativo();

    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📊 Desempenho Bimestral</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Lançamento oficial das notas e fechamento do ciclo.</p>
        </div>

        <h4 class="font-black text-lg uppercase tracking-wider mb-4 px-2 border-l-4 border-black">📅 Período Avaliativo - ${session.profArea}</h4>

        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bimestre de Lançamento</label>
            <select id="rm-bimestre" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${["I", "II", "III", "IV"].map(b => `<option value="${b}" ${b === bimestreSelecionado ? 'selected' : ''}>Bimestre ${b}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Data do Relatório</label>
            <input type="date" id="rm-data" value="${dataSelecionada}" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
          </div>
        </div>
    `;

    html += renderConsolidadoQuantitativo(resumoQuantitativo, bimestreSelecionado, dataSelecionada);

    if (meusEstudantes.length === 0) {
      html += `<div class="bg-blue-50 border-2 border-black p-4 text-center">
        <p class="font-bold text-blue-800">Nenhum estudante matriculado nas suas turmas atualmente.</p>
      </div></div>`;
      container.innerHTML = html; attachEvents(); return;
    }

    html += `
        <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
          <label class="block text-sm font-black uppercase tracking-wide text-black mb-2">🎯 Selecione o Estudante para Avaliar</label>
          <select id="rm-aluno" class="w-full border-2 border-black p-3 bg-yellow-50 font-black text-sm outline-none uppercase mb-2">
            <option value="">Selecione...</option>
            ${meusEstudantes.map(e => `<option value="${e.id}" ${e.id === estudanteSelecionado ? 'selected' : ''}>${e.nome} - ${e.turma_nome}</option>`).join('')}
          </select>
    `;

    if (estudanteSelecionado) {
      const estSel = meusEstudantes.find((e) => String(e.id) === String(estudanteSelecionado)) || null;
      const etapaNorm = normalizeEtapa(estSel?.etapa_nome || '');
      const ehAnosFinais = etapaNorm.includes('ANOS FINAIS');

      if (regenteMatch) {
        html += `<p class="text-[10px] text-gray-500 font-bold italic mb-4">🤝 Relatório Oficial será espelhado no painel do Diretor e do Regente: <b>${regenteMatch.nome}</b></p>`;
      }

      if (regExistente) {
        html += `<div class="bg-green-50 border-2 border-black p-3 mb-6"><p class="text-green-800 font-bold text-xs">✅ O Consolidado do Bimestre ${bimestreSelecionado} já foi fechado! Você pode alterar as notas abaixo.</p></div>`;
      }

      html += `
        <div class="mb-4 bg-white border-2 border-black p-3">
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500">Etapa vinculada ao estudante</p>
          <p class="text-xs font-black mt-1">${estSel?.etapa_nome || 'Não definida'}</p>
        </div>
      `;

      html += renderResumoFrequencia(resumoFrequencia || { total: 0, presencas: 0, faltas: 0, pctPresenca: 0 });

      html += renderEscalaNota10();

      const formTitle = regExistente ? `Edição de Boletim - Bimestre ${bimestreSelecionado}` : `Novo Boletim - Bimestre ${bimestreSelecionado}`;
      const btnLabel = regExistente ? `💾 Salvar Alterações` : `🚀 Publicar Relatório`;

      let fallbackVal = mediaDiaria ? Math.max(1, Math.min(10, Math.round(mediaDiaria * 2.5))) : 5;
      
      html += `<div class="border-2 border-black p-4 mt-4 bg-gray-50">
        <h3 class="font-black text-sm uppercase mb-4">${formTitle}</h3>
      `;

      if (mediaDiaria !== null && !regExistente) {
        const idx = Math.min(3, Math.max(0, Math.round(mediaDiaria) - 1));
        const nivelStr = ESCALA_COMPREENSAO[idx];
        html += `<p class="text-[10px] text-blue-600 font-bold italic mb-4 bg-blue-100 p-2 border border-black">🤖 Sugestão baseada na média diária de <b>${mediaDiaria}/4</b> (${nivelStr}) nos Diários deste bimestre.</p>`;
      }

      if (session.profArea === "Matemática") {
        html += `<h5 class="font-black text-xs uppercase mb-3 text-black">🧮 Habilidades Matemáticas (Escala de 1 a 10)</h5>
          <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            ${numInput('mat_adicao', 'Adição', regExistente?.mat_adicao ?? fallbackVal)}
            ${numInput('mat_subtracao', 'Subtração', regExistente?.mat_subtracao ?? fallbackVal)}
            ${numInput('mat_multiplicacao', 'Multiplicação', regExistente?.mat_multiplicacao ?? fallbackVal)}
            ${numInput('mat_divisao', 'Divisão', regExistente?.mat_divisao ?? fallbackVal)}
            ${numInput('mat_resolucao', 'Resolução de Problemas', regExistente?.mat_resolucao ?? fallbackVal)}
          </div>
        `;
      } else if (session.profArea === "Português") {
        html += `<h5 class="font-black text-xs uppercase mb-3 text-black">📝 Habilidades de Linguagem (Escala de 1 a 10)</h5>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            ${numInput('port_escrita', 'Nível de Escrita', regExistente?.port_escrita ?? fallbackVal)}
            ${numInput('port_leitura', 'Nível de Leitura', regExistente?.port_leitura ?? fallbackVal)}
            ${numInput('port_interpretacao', 'Interpretação Textual', regExistente?.port_interpretacao ?? fallbackVal)}
            ${numInput('port_pontuacao', 'Pontuação e Acent.', regExistente?.port_pontuacao ?? fallbackVal)}
          </div>
        `;
      } else {
        html += `<div class="bg-yellow-100 border-2 border-black p-3 mb-4"><p class="text-xs text-yellow-800 font-bold">Sua área não está configurada como Português ou Matemática. Preencha apenas o desfecho geral.</p></div>`;
      }

      html += `
        <div class="border-2 border-black p-3 mb-5 bg-white">
          <p class="text-[10px] font-black uppercase tracking-wider mb-3">🧩 Campos de Consolidação (Base das Fichas)</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nível Inicial - Escrita</label>
              ${selectInput('rm-nivel-inicial-escrita', NIVEIS_ESCRITA_BASE, regExistente?.nivel_inicial_escrita || '')}
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nível Inicial - Leitura</label>
              ${selectInput('rm-nivel-inicial-leitura', NIVEIS_LEITURA_BASE, regExistente?.nivel_inicial_leitura || '')}
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Carga Horária Cumprida (dias/semana)</label>
              <input type="number" id="rm-carga-dias" min="0" max="7" value="${regExistente?.carga_horaria_dias_semana ?? ''}" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Data da Entrega ao Regente</label>
              <input type="date" id="rm-data-entrega-regente" value="${regExistente?.data_entrega_regente || dataSelecionada}" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">${ehAnosFinais ? 'Status Final - Escrita, Leitura e Interpretação' : 'Status Final - Leitura e Escrita'}</label>
            <textarea id="rm-status-final" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16" placeholder="Descreva o status final do estudante">${regExistente?.status_final_consolidado || ''}</textarea>
          </div>
          <div class="mb-3">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Observações Pedagógicas</label>
            <textarea id="rm-obs-pedagogica" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16" placeholder="Registre evidências concretas">${regExistente?.observacoes_pedagogicas || ''}</textarea>
          </div>
          <div class="mb-1 flex items-center gap-3 p-3 border-2 border-black bg-gray-50 cursor-pointer hover:bg-gray-100" onclick="document.getElementById('rm-regente-ciente').click()">
            <input type="checkbox" id="rm-regente-ciente" class="w-5 h-5 accent-black" ${regExistente?.regente_ciente_frequencia ? 'checked' : ''} onclick="event.stopPropagation()">
            <div>
              <p class="font-black text-sm uppercase">Professor Regente Ciente da Frequência e Consolidação</p>
              <p class="text-[10px] font-bold text-gray-500">Campo inspirado na assinatura do regente nas fichas físicas.</p>
            </div>
          </div>
        </div>
      `;

      if (ehAnosFinais && session.profArea === 'Português') {
        html += `
          <div class="border-2 border-black p-3 mb-5 bg-indigo-50">
            <p class="text-[10px] font-black uppercase tracking-wider mb-3">📚 Consolidação Anos Finais - Português (Casos Avançados)</p>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              ${numInput('af_localizar_info', 'Localizar informação explícita', regExistente?.af_localizar_info ?? fallbackVal)}
              ${numInput('af_inferir_sentido', 'Inferir sentido de palavra', regExistente?.af_inferir_sentido ?? fallbackVal)}
              ${numInput('af_identificar_tema', 'Identificar tema central', regExistente?.af_identificar_tema ?? fallbackVal)}
              ${numInput('af_pontuacao_sentido', 'Pontuação e sentido', regExistente?.af_pontuacao_sentido ?? fallbackVal)}
            </div>
          </div>
        `;
      }

      const valParecer = regExistente?.parecer_evolutivo || "Avançou parcialmente";
      const valAlta = regExistente?.recomendacao_alta || false;

      html += `<div class="border-t-4 border-black pt-4 mt-6">
        <h5 class="font-black text-xs uppercase mb-4 text-black">🔎 Desfecho Final Pedagógico (Cirúrgico)</h5>
        
        <div class="mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Situação do Aprendizado do Aluno neste Bimestre</label>
          <select id="rm-parecer" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
            ${["Avançou bastante", "Avançou parcialmente", "Não conseguiu avançar (Estagnado)"].map(o => `<option value="${o}" ${o === valParecer ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>

        <div class="mb-4 flex items-center gap-3 p-3 border-2 border-black bg-white cursor-pointer hover:bg-gray-50" onclick="document.getElementById('rm-alta').click()">
          <input type="checkbox" id="rm-alta" class="w-5 h-5 accent-black" ${valAlta ? 'checked' : ''} onclick="event.stopPropagation()">
          <div>
            <p class="font-black text-sm uppercase">🎓 RECOMENDAR ALTA DO REFORÇO?</p>
            <p class="text-[10px] font-bold text-gray-500">Ative se o aluno atingiu fluência mínima para acompanhar a sala regular.</p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">📌 Ação Pedagógica Sugerida para o Regente</label>
          <textarea id="rm-acao" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16" placeholder="Ex: Manter sentado à frente">${regExistente?.acao_pedagogica || ''}</textarea>
        </div>

        <div class="mb-6">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Observação Geral Privada (Opcional)</label>
          <textarea id="rm-obs" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16">${regExistente?.observacao_geral || ''}</textarea>
        </div>

        <button id="btn-save-rm" class="w-full bg-black border-2 border-black text-white px-4 py-3 font-black uppercase tracking-wider text-sm btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-800 flex items-center justify-center gap-2">
          <i data-lucide="check" class="w-5 h-5"></i> ${btnLabel}
        </button>
      </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function numInput(id, label, val) {
    return `<div>
      <label class="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 truncate">${label}</label>
      <input type="number" id="rm-${id}" min="1" max="10" value="${val}" class="w-full border-2 border-black p-2 font-black text-center text-lg bg-white outline-none focus:ring-2 focus:ring-black input-rm">
    </div>`;
  }

  function selectInput(id, options, selected) {
    return `
      <select id="${id}" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
        <option value="">Selecione...</option>
        ${(options || []).map((opt) => `<option value="${opt}" ${opt === selected ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    `;
  }

  function renderResumoFrequencia(resumo) {
    const total = Number(resumo?.total || 0);
    const presencas = Number(resumo?.presencas || 0);
    const faltas = Number(resumo?.faltas || 0);
    const pct = Number(resumo?.pctPresenca || 0);
    const badge = pct >= 75 ? 'bg-green-100 text-green-900' : (pct >= 60 ? 'bg-yellow-100 text-yellow-900' : 'bg-red-200 text-red-900');

    return `
      <div class="mb-5 bg-emerald-50 border-2 border-black p-3">
        <p class="text-[10px] font-black uppercase tracking-wider">📌 Resumo da Ficha de Frequência (Bimestre)</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <div class="border border-black bg-white p-2 text-center">
            <p class="text-[10px] font-bold uppercase text-gray-500">Registros</p>
            <p class="text-lg font-black">${total}</p>
          </div>
          <div class="border border-black bg-white p-2 text-center">
            <p class="text-[10px] font-bold uppercase text-gray-500">Presenças</p>
            <p class="text-lg font-black">${presencas}</p>
          </div>
          <div class="border border-black bg-white p-2 text-center">
            <p class="text-[10px] font-bold uppercase text-gray-500">Faltas</p>
            <p class="text-lg font-black">${faltas}</p>
          </div>
          <div class="border border-black bg-white p-2 text-center">
            <p class="text-[10px] font-bold uppercase text-gray-500">% Frequência</p>
            <p class="text-lg font-black"><span class="px-2 border border-black ${badge}">${pct}%</span></p>
          </div>
        </div>
      </div>
    `;
  }

  function normalizeEtapa(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  function calcularResumoQuantitativoAutomatico(rows, alunoMap = {}) {
    const portLatest = new Map();
    const matLatest = new Map();

    (rows || []).forEach((r) => {
      const alunoId = String(r?.estudante_id || '');
      if (!alunoId) return;
      const data = String(r?.data_registro || '');

      const mediaPort = mediaPortuguesRegistro(r);
      if (mediaPort !== null) {
        const atual = portLatest.get(alunoId);
        if (!atual || data >= atual.data) portLatest.set(alunoId, { data, media: mediaPort, raw: r });
      }

      const mediaMat = mediaMatematicaRegistro(r);
      if (mediaMat !== null) {
        const atual = matLatest.get(alunoId);
        if (!atual || data >= atual.data) matLatest.set(alunoId, { data, media: mediaMat, raw: r });
      }
    });

    const portugues = buildDisciplinaResumo(portLatest, alunoMap);
    const matematica = buildDisciplinaResumo(matLatest, alunoMap);

    return { portugues, matematica };
  }

  function buildDisciplinaResumo(mapper, alunoMap = {}) {
    const resumo = { metas: [], processo: [], defasagem: [], total: 0 };

    mapper.forEach((info, alunoId) => {
      const est = alunoMap[alunoId] || {};
      const nome = est.nome || `Aluno ${alunoId}`;
      const turma = est.turma_nome || '';
      const item = { alunoId, nome, turma, media: info.media };
      const categoria = classificarFaixa(info.media);
      resumo[categoria].push(item);
      resumo.total += 1;
    });

    const ordena = (a, b) => (a.nome || '').localeCompare(b.nome || '');
    resumo.metas.sort(ordena);
    resumo.processo.sort(ordena);
    resumo.defasagem.sort(ordena);
    return resumo;
  }

  function classificarFaixa(media) {
    const n = Number(media);
    if (!Number.isFinite(n)) return 'defasagem';
    if (n >= 7) return 'metas';
    if (n >= 4) return 'processo';
    return 'defasagem';
  }

  function mediaPortuguesRegistro(row) {
    const base = mediaLista([
      row?.port_escrita,
      row?.port_leitura,
      row?.port_interpretacao,
      row?.port_pontuacao
    ]);

    const avancado = mediaLista([
      row?.af_localizar_info,
      row?.af_inferir_sentido,
      row?.af_identificar_tema,
      row?.af_pontuacao_sentido
    ]);

    if (base === null && avancado === null) return null;
    if (base !== null && avancado !== null) return Number(((base + avancado) / 2).toFixed(1));
    return base !== null ? base : avancado;
  }

  function mediaMatematicaRegistro(row) {
    return mediaLista([
      row?.mat_adicao,
      row?.mat_subtracao,
      row?.mat_multiplicacao,
      row?.mat_divisao,
      row?.mat_resolucao
    ]);
  }

  function mediaLista(lista = []) {
    const validos = (lista || [])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (validos.length === 0) return null;
    const soma = validos.reduce((acc, n) => acc + n, 0);
    return Number((soma / validos.length).toFixed(1));
  }

  function renderResumoNomes(items = []) {
    if (!items.length) return `<span class="text-gray-400 font-bold">—</span>`;
    const top = items.slice(0, 5)
      .map((x) => `${x.nome}${x.turma ? ` (${x.turma})` : ''} [${x.media.toFixed(1)}]`);
    const resto = items.length - top.length;
    return `${top.join(', ')}${resto > 0 ? ` +${resto} aluno(s)` : ''}`;
  }

  function formatQtdPct(qtd, total) {
    const nQtd = Number(qtd || 0);
    const nTotal = Number(total || 0);
    const pct = nTotal > 0 ? Math.round((nQtd / nTotal) * 100) : 0;
    return `${nQtd} (${pct}%)`;
  }

  function renderEscalaNota10() {
    return `
      <div class="mb-5 border-2 border-black bg-white p-3">
        <p class="text-[10px] font-black uppercase tracking-wider mb-2">🧭 Guia da Escala 1–10 (Leitura Pedagógica)</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${ESCALA_NOTA_10.map((item) => `
            <div class="border border-black bg-gray-50 p-2">
              <p class="text-[10px] font-black">Nível ${item.nota} - ${item.titulo}</p>
              <p class="text-[10px] text-gray-700 font-bold mt-0.5">${item.descricao}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderConsolidadoQuantitativo(resumo, bimestre, dataRef) {
    const ano = Number(String(dataRef || '').split('-')[0]) || new Date().getFullYear();
    if (!resumo) {
      return `
        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p class="text-xs font-black uppercase tracking-wider text-gray-500">Consolidado Quantitativo (Automático)</p>
          <p class="text-xs font-bold text-gray-500 mt-2">Não foi possível calcular agora.</p>
        </div>
      `;
    }

    const p = resumo.portugues;
    const m = resumo.matematica;
    const linhas = [
      { key: 'metas', label: 'Atingiram as metas' },
      { key: 'processo', label: 'Em processo de evolução' },
      { key: 'defasagem', label: 'Permanecem em defasagem' }
    ];

    return `
      <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b-2 border-black pb-2 mb-3">
          <p class="text-xs font-black uppercase tracking-wider">📈 Consolidado Quantitativo (Automático)</p>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500">Bimestre ${bimestre} • ${ano}</p>
        </div>
        <p class="text-[10px] font-bold text-gray-600 mb-3">
          Critério automático: média >= 7.0 (metas), média entre 4.0 e 6.9 (em processo), média < 4.0 (defasagem).
        </p>

        <div class="overflow-x-auto">
          <table class="min-w-full border border-black text-[10px]">
            <thead class="bg-black text-white">
              <tr>
                <th class="p-2 text-left">Categoria</th>
                <th class="p-2 text-left">Português - Situação Específica</th>
                <th class="p-2 text-center">Português - Quant.</th>
                <th class="p-2 text-left">Matemática - Situação Específica</th>
                <th class="p-2 text-center">Matemática - Quant.</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map((row) => `
                <tr class="border-t border-black bg-white align-top">
                  <td class="p-2 font-black">${row.label}</td>
                  <td class="p-2">${renderResumoNomes(p[row.key])}</td>
                  <td class="p-2 text-center font-black">${formatQtdPct((p[row.key] || []).length, p.total)}</td>
                  <td class="p-2">${renderResumoNomes(m[row.key])}</td>
                  <td class="p-2 text-center font-black">${formatQtdPct((m[row.key] || []).length, m.total)}</td>
                </tr>
              `).join('')}
              <tr class="border-t-2 border-black bg-gray-100">
                <td class="p-2 font-black">Total de Participantes</td>
                <td class="p-2 text-[10px] font-bold text-gray-600">Registros válidos no período</td>
                <td class="p-2 text-center font-black">${p.total}</td>
                <td class="p-2 text-[10px] font-bold text-gray-600">Registros válidos no período</td>
                <td class="p-2 text-center font-black">${m.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function attachEvents() {
    const cn = container;
    
    cn.querySelector('#rm-bimestre')?.addEventListener('change', (e) => { bimestreSelecionado = e.target.value; renderPage(); });
    cn.querySelector('#rm-data')?.addEventListener('change', (e) => { dataSelecionada = e.target.value; });
    cn.querySelector('#rm-aluno')?.addEventListener('change', (e) => { estudanteSelecionado = e.target.value; renderPage(); });

    cn.querySelector('#btn-save-rm')?.addEventListener('click', async () => {
      const btn = cn.querySelector('#btn-save-rm');
      btn.innerHTML = 'Salvando...'; btn.disabled = true;

      const gv = (id) => { const el = cn.querySelector('#rm-'+id); return el ? parseInt(el.value) || null : null; };
      const txt = (id) => {
        const el = cn.querySelector('#' + id);
        if (!el) return null;
        const value = String(el.value || '').trim();
        return value || null;
      };
      const qtdDiasSemana = (() => {
        const raw = cn.querySelector('#rm-carga-dias')?.value;
        if (raw === undefined || raw === null || raw === '') return null;
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) return null;
        return Math.max(0, Math.min(7, n));
      })();
      const freqTotal = Number(resumoFrequencia?.total || 0);
      const freqPresencas = Number(resumoFrequencia?.presencas || 0);
      const freqFaltas = Number(resumoFrequencia?.faltas || 0);
      const freqPct = Number(resumoFrequencia?.pctPresenca || 0);
      
      const payload = {
        estudante_id: estudanteSelecionado,
        prof_id: session.profId,
        prof_regente_id: regenteMatch ? regenteMatch.id : null,
        data_registro: dataSelecionada,
        bimestre: bimestreSelecionado,
        mat_adicao: gv('mat_adicao'), mat_subtracao: gv('mat_subtracao'), mat_multiplicacao: gv('mat_multiplicacao'), mat_divisao: gv('mat_divisao'), mat_resolucao: gv('mat_resolucao'),
        port_escrita: gv('port_escrita'), port_leitura: gv('port_leitura'), port_interpretacao: gv('port_interpretacao'), port_pontuacao: gv('port_pontuacao'),
        af_localizar_info: gv('af_localizar_info'),
        af_inferir_sentido: gv('af_inferir_sentido'),
        af_identificar_tema: gv('af_identificar_tema'),
        af_pontuacao_sentido: gv('af_pontuacao_sentido'),
        nivel_inicial_escrita: txt('rm-nivel-inicial-escrita'),
        nivel_inicial_leitura: txt('rm-nivel-inicial-leitura'),
        carga_horaria_dias_semana: qtdDiasSemana,
        status_final_consolidado: txt('rm-status-final'),
        observacoes_pedagogicas: txt('rm-obs-pedagogica'),
        data_entrega_regente: txt('rm-data-entrega-regente'),
        regente_ciente_frequencia: !!cn.querySelector('#rm-regente-ciente')?.checked,
        freq_total_bimestre: freqTotal,
        freq_presencas_bimestre: freqPresencas,
        freq_faltas_bimestre: freqFaltas,
        freq_percentual_bimestre: freqPct,
        parecer_evolutivo: cn.querySelector('#rm-parecer').value,
        recomendacao_alta: cn.querySelector('#rm-alta').checked,
        acao_pedagogica: cn.querySelector('#rm-acao').value || null,
        observacao_geral: cn.querySelector('#rm-obs').value || null
      };

      try {
        if (regExistente) {
          await atualizarConsolidadoMensal(regExistente.id, payload);
          alert('Alterações salvas com sucesso!');
        } else {
          await criarConsolidadoMensal(payload);
          alert('Relatório publicado com sucesso!');
        }
      } catch (e) {
        console.error(e); alert('Erro ao salvar relatório.');
      }
      renderPage();
    });
  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📊 Desempenho Bimestral</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}
