/**
 * 🧪 PAINEL DE EFETIVIDADE DE INTERVENÇÃO — Coordenação
 * Cruza tipo_atividade/origem_conteudo com ganho de compreensão.
 */

import { listarTodosRegistrosMes, listarTurmas, listarProfsReforco, compreensaoParaNota } from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export async function renderEfetividadeIntervencao(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();
  let turmaSel = '';
  let profSel = '';
  let carregou = false;

  let registrosMes = [];
  let turmas = [];
  let profs = [];
  const turmasMap = {};

  container.innerHTML = loadingHTML();

  try {
    [turmas, profs] = await Promise.all([listarTurmas(), listarProfsReforco()]);
    turmas.forEach((t) => { turmasMap[t.id] = t; });
  } catch (e) {
    console.error('Erro ao carregar base de efetividade:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Resultado das Intervenções</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Veja quais atividades geram mais ganho de compreensão.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="ei-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="ei-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="ei-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Professor</label>
              <select id="ei-prof" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${profs.map((p) => `<option value="${p.id}" ${String(p.id) === String(profSel) ? 'selected' : ''}>${esc(p.nome)} (${esc(p.area || 'Sem área')})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-ei-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="flask-conical" class="w-4 h-4"></i> Ver Resultados
            </button>
          </div>
        </div>

        <div id="ei-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#ei-mes')?.addEventListener('change', (e) => { mesSel = Number(e.target.value); });
    container.querySelector('#ei-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#ei-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#ei-prof')?.addEventListener('change', (e) => { profSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-ei-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-ei-analisar');
      btn.disabled = true;
      btn.innerHTML = 'Analisando...';
      await carregarRegistros();
      renderPage();
    });
  }

  async function carregarRegistros() {
    try {
      registrosMes = await listarTodosRegistrosMes(mesSel, anoSel);
      carregou = true;
    } catch (e) {
      console.error('Erro ao carregar dados de efetividade:', e);
      registrosMes = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="flask-conical" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Ver Resultados"</p>
        </div>
      `;
    }

    const filtrados = aplicarFiltros(registrosMes);
    if (filtrados.length === 0) {
      return `
        <div class="bg-white border-2 border-black p-6 text-center">
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Nenhum registro encontrado para os filtros.</p>
        </div>
      `;
    }

    return renderAnalise(filtrados);
  }

  function aplicarFiltros(regs) {
    let out = [...regs];

    if (turmaSel) {
      const turmaNome = turmasMap[turmaSel]?.nome || '';
      out = out.filter((r) => (r.turma_nome || '') === turmaNome);
    }
    if (profSel) out = out.filter((r) => String(r.prof_id || '') === String(profSel));

    return out;
  }

  function renderAnalise(dados) {
    const presentes = dados.filter((r) => isPresent(r));
    if (presentes.length === 0) {
      return `
        <div class="bg-white border-2 border-black p-6 text-center">
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Não há presenças no recorte selecionado.</p>
        </div>
      `;
    }

    const tipoStats = agregaCategoria(presentes, (r) => r.tipo_atividade, 'Não informado');
    const origemStats = agregaCategoria(presentes, (r) => r.origem_conteudo, 'Não informado');
    const ganhoGeral = calculaGanhoMedio(presentes);
    const progressoAlunos = calculaProgressoPorAluno(presentes);
    const alunosSemEvolucao = progressoAlunos.filter((a) => a.ganho !== null && a.ganho <= 0).length;
    const tiposPositivos = tipoStats.filter((t) => t.ganhoMedio > 0).length;

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${metricCard('Presenças Analisadas', presentes.length, 'user-check', 'green')}
        ${metricCard('Ganho Médio (Período)', formatSigned(ganhoGeral), 'trending-up', ganhoGeral >= 0 ? 'emerald' : 'red')}
        ${metricCard('Alunos sem Evolução', alunosSemEvolucao, 'triangle-alert', alunosSemEvolucao > 0 ? 'amber' : 'gray')}
        ${metricCard('Tipos com Ganho Positivo', tiposPositivos, 'thumbs-up', 'blue')}
      </div>
      <p class="text-[10px] font-bold text-gray-500 mb-6">Priorize as atividades e origens com ganho positivo e revise os alunos sem evolução.</p>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="list-checks" class="w-4 h-4 text-emerald-700"></i> Evolução por Aluno (Lista Direta)
        </h3>
        ${renderListaProgressoAlunos(progressoAlunos)}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="puzzle" class="w-4 h-4 text-blue-600"></i> Atividades Mais Eficientes
          </h3>
          ${renderTabelaEfetividade(tipoStats.slice(0, 10))}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="book-open-check" class="w-4 h-4 text-purple-600"></i> Origem de Conteúdo Mais Eficiente
          </h3>
          ${renderTabelaEfetividade(origemStats.slice(0, 10))}
        </div>
      </div>
    `;
  }
}

function agregaCategoria(registros, getCategoria, fallback) {
  const map = {};

  registros.forEach((r) => {
    const cat = limpa(getCategoria(r), fallback);
    const nota = compreensaoParaNota(r.nivel_compreensao ?? 0);
    const alunoId = String(r.estudante_id || '');
    const data = String(r.data_registro || '');

    if (!map[cat]) {
      map[cat] = {
        categoria: cat,
        total: 0,
        somaNota: 0,
        qtdNota: 0,
        alunos: new Set(),
        evol: {}
      };
    }

    const row = map[cat];
    row.total += 1;
    row.alunos.add(alunoId);

    if (nota > 0) {
      row.somaNota += nota;
      row.qtdNota += 1;

      if (!row.evol[alunoId]) {
        row.evol[alunoId] = { firstDate: data, firstNota: nota, lastDate: data, lastNota: nota };
      } else {
        if (data < row.evol[alunoId].firstDate) {
          row.evol[alunoId].firstDate = data;
          row.evol[alunoId].firstNota = nota;
        }
        if (data > row.evol[alunoId].lastDate) {
          row.evol[alunoId].lastDate = data;
          row.evol[alunoId].lastNota = nota;
        }
      }
    }
  });

  return Object.values(map).map((r) => {
    const mediaComp = r.qtdNota > 0 ? (r.somaNota / r.qtdNota) : 0;
    const ganhos = [];
    Object.values(r.evol).forEach((e) => {
      if (e.firstDate && e.lastDate && e.lastDate > e.firstDate) ganhos.push(e.lastNota - e.firstNota);
    });

    const ganhoMedio = ganhos.length > 0 ? (ganhos.reduce((a, b) => a + b, 0) / ganhos.length) : 0;
    const taxaPositiva = ganhos.length > 0 ? Math.round((ganhos.filter((g) => g > 0).length / ganhos.length) * 100) : 0;

    return {
      categoria: r.categoria,
      total: r.total,
      alunos: r.alunos.size,
      mediaComp,
      ganhoMedio,
      taxaPositiva
    };
  }).sort((a, b) => {
    if (b.ganhoMedio !== a.ganhoMedio) return b.ganhoMedio - a.ganhoMedio;
    return b.mediaComp - a.mediaComp;
  });
}

function renderTabelaEfetividade(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados suficientes.</p>`;

  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.map((r) => `
        <div class="border-2 border-black p-2 bg-gray-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.categoria)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${r.ganhoMedio >= 0 ? 'bg-green-100 text-green-900' : 'bg-red-200 text-red-900'}">${formatSigned(r.ganhoMedio)}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <p class="text-[10px] font-bold text-gray-500">Regs: <b>${r.total}</b></p>
            <p class="text-[10px] font-bold text-gray-500">Alunos: <b>${r.alunos}</b></p>
            <p class="text-[10px] font-bold text-gray-500">Comp.: <b>${r.mediaComp.toFixed(1)}/4</b></p>
          </div>
          <p class="text-[10px] font-bold text-gray-600 mt-1">Evolução positiva: <b>${r.taxaPositiva}%</b></p>
        </div>
      `).join('')}
    </div>
  `;
}

function calculaGanhoMedio(registros) {
  const alunoMap = {};

  registros.forEach((r) => {
    const alunoId = String(r.estudante_id || '');
    const data = String(r.data_registro || '');
    const nota = compreensaoParaNota(r.nivel_compreensao ?? 0);
    if (nota <= 0) return;

    if (!alunoMap[alunoId]) {
      alunoMap[alunoId] = { firstDate: data, firstNota: nota, lastDate: data, lastNota: nota };
      return;
    }

    if (data < alunoMap[alunoId].firstDate) {
      alunoMap[alunoId].firstDate = data;
      alunoMap[alunoId].firstNota = nota;
    }
    if (data > alunoMap[alunoId].lastDate) {
      alunoMap[alunoId].lastDate = data;
      alunoMap[alunoId].lastNota = nota;
    }
  });

  const ganhos = [];
  Object.values(alunoMap).forEach((e) => {
    if (e.lastDate > e.firstDate) ganhos.push(e.lastNota - e.firstNota);
  });

  if (ganhos.length === 0) return 0;
  return ganhos.reduce((a, b) => a + b, 0) / ganhos.length;
}

function calculaProgressoPorAluno(registros) {
  const alunoMap = {};

  registros.forEach((r) => {
    const alunoId = String(r.estudante_id || '');
    const data = String(r.data_registro || '');
    const nota = compreensaoParaNota(r.nivel_compreensao ?? 0);

    if (!alunoMap[alunoId]) {
      alunoMap[alunoId] = {
        aluno: r.estudante_nome || 'Sem nome',
        turma: r.turma_nome || 'Sem turma',
        professor: r.prof_nome || 'Sem professor',
        sessoes: 0,
        primeiraData: data,
        ultimaData: data,
        primeiraNota: nota > 0 ? nota : null,
        ultimaNota: nota > 0 ? nota : null,
        ultimaAtividade: limpa(r.tipo_atividade, 'Não informado'),
        ultimaOrigem: limpa(r.origem_conteudo, 'Não informado')
      };
    }

    const row = alunoMap[alunoId];
    row.sessoes += 1;

    if (data && (!row.primeiraData || data < row.primeiraData)) {
      row.primeiraData = data;
      if (nota > 0) row.primeiraNota = nota;
    }

    if (data && (!row.ultimaData || data > row.ultimaData)) {
      row.ultimaData = data;
      if (nota > 0) row.ultimaNota = nota;
      row.ultimaAtividade = limpa(r.tipo_atividade, 'Não informado');
      row.ultimaOrigem = limpa(r.origem_conteudo, 'Não informado');
      row.professor = r.prof_nome || row.professor;
    }
  });

  return Object.values(alunoMap).map((a) => {
    const hasEvolucao = a.primeiraNota !== null && a.ultimaNota !== null && a.ultimaData > a.primeiraData;
    const ganho = hasEvolucao ? (a.ultimaNota - a.primeiraNota) : null;
    return {
      ...a,
      ganho,
      ganhoTxt: ganho === null ? 'N/D' : formatSigned(ganho),
      compInicial: notaParaTexto(a.primeiraNota),
      compFinal: notaParaTexto(a.ultimaNota)
    };
  }).sort((a, b) => {
    if (a.ganho === null && b.ganho !== null) return 1;
    if (a.ganho !== null && b.ganho === null) return -1;
    if (a.ganho !== null && b.ganho !== null && a.ganho !== b.ganho) return a.ganho - b.ganho;
    return (a.aluno || '').localeCompare(b.aluno || '');
  });
}

function renderListaProgressoAlunos(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem dados de evolução por aluno no período.</p>`;
  }

  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 60).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${badgeGanho(r.ganho)}">${r.ganhoTxt}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.professor)} • ${r.sessoes} atendimento(s)</p>
          <p class="text-[10px] font-bold mt-1">Compreensão: ${esc(r.compInicial)} → ${esc(r.compFinal)}</p>
          <p class="text-[10px] font-bold text-gray-700">Última intervenção: ${esc(r.ultimaAtividade)} • ${esc(r.ultimaOrigem)}</p>
          <p class="text-[10px] font-bold text-gray-500">${formatDate(r.primeiraData)} até ${formatDate(r.ultimaData)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function badgeGanho(ganho) {
  if (ganho === null) return 'bg-gray-100 text-gray-700';
  if (ganho > 0) return 'bg-green-100 text-green-900';
  if (ganho < 0) return 'bg-red-200 text-red-900';
  return 'bg-amber-100 text-amber-900';
}

function notaParaTexto(nota) {
  if (nota === 1) return 'Não compreendeu';
  if (nota === 2) return 'Com muita intervenção';
  if (nota === 3) return 'Com pouca intervenção';
  if (nota === 4) return 'Autônomo';
  return 'Sem avaliação';
}

function metricCard(label, valor, icon, color) {
  return `
    <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
      <div class="flex items-center justify-center gap-1 mb-1">
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
        <p class="text-[9px] font-bold uppercase tracking-wider text-gray-500">${label}</p>
      </div>
      <p class="text-2xl font-black">${valor}</p>
    </div>
  `;
}

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function isPresent(r) {
  return r?.compareceu === 1 || r?.compareceu === true || r?.presente === 1 || r?.presente === true;
}

function limpa(v, fallback) {
  const txt = String(v || '').trim();
  return txt || fallback;
}

function formatSigned(v) {
  const n = Number(v) || 0;
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return '—';
  const parts = String(d).split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadingHTML() {
  return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Resultado das Intervenções</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}
