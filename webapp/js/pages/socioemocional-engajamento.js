/**
 * 💛 PAINEL SOCIOEMOCIONAL E ENGAJAMENTO — Coordenação
 * Analisa estado emocional e participação dos estudantes atendidos.
 */

import { listarTodosRegistrosMes, listarTurmas, listarProfsReforco } from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ORDEM_ESTADO = ['Não Observado', 'Tranquilo / Calmo', 'Triste / Apático', 'Irritado / Frustrado', 'Ansioso', 'Eufórico / Muito Agitado', 'Não informado'];
const ORDEM_ENGAJ = ['Muito Focado e Participativo', 'Participação Regular', 'Desatento / Disperso', 'Agitado / Inquieto', 'Recusou-se a Realizar Tarefas', 'Não informado'];
const ESTADOS_ALERTA = new Set(['Triste / Apático', 'Irritado / Frustrado', 'Ansioso', 'Eufórico / Muito Agitado']);
const ENGAJ_ALERTA = new Set(['Desatento / Disperso', 'Agitado / Inquieto', 'Recusou-se a Realizar Tarefas']);

export async function renderSocioemocionalEngajamento(container, session) {
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
    console.error('Erro ao carregar base socioemocional:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Comportamento e Participação</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Veja como os alunos estão se sentindo e participando.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="se-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="se-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="se-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Professor</label>
              <select id="se-prof" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${profs.map((p) => `<option value="${p.id}" ${String(p.id) === String(profSel) ? 'selected' : ''}>${esc(p.nome)} (${esc(p.area || 'Sem área')})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-se-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="heart-pulse" class="w-4 h-4"></i> Ver Comportamento
            </button>
          </div>
        </div>

        <div id="se-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#se-mes')?.addEventListener('change', (e) => { mesSel = Number(e.target.value); });
    container.querySelector('#se-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#se-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#se-prof')?.addEventListener('change', (e) => { profSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-se-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-se-analisar');
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
      console.error('Erro ao carregar registros socioemocionais:', e);
      registrosMes = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="heart-pulse" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Ver Comportamento"</p>
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
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Não há registros de presença no recorte.</p>
        </div>
      `;
    }

    const estadoCount = {};
    const engajCount = {};
    const matriz = {};
    const alunoStats = {};
    const totalAluno = {};
    const eventosAlerta = [];

    presentes.forEach((r) => {
      const estado = limpaEstado(r.estado_emocional);
      const engaj = limpaEngaj(r.participacao);
      const idAluno = String(r.estudante_id || 'sem_id');

      estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      engajCount[engaj] = (engajCount[engaj] || 0) + 1;
      totalAluno[idAluno] = (totalAluno[idAluno] || 0) + 1;

      if (!matriz[estado]) matriz[estado] = {};
      matriz[estado][engaj] = (matriz[estado][engaj] || 0) + 1;

      const sinalEstado = ESTADOS_ALERTA.has(estado);
      const sinalEngaj = ENGAJ_ALERTA.has(engaj);
      if (sinalEstado || sinalEngaj) {
        if (!alunoStats[idAluno]) {
          alunoStats[idAluno] = {
            nome: r.estudante_nome || 'Sem nome',
            turma: r.turma_nome || 'Sem turma',
            estado: 0,
            engaj: 0,
            ultimoEstado: estado,
            ultimoEngaj: engaj,
            dataUltima: r.data_registro || ''
          };
        }
        if (sinalEstado) alunoStats[idAluno].estado += 1;
        if (sinalEngaj) alunoStats[idAluno].engaj += 1;
        if ((r.data_registro || '') >= (alunoStats[idAluno].dataUltima || '')) {
          alunoStats[idAluno].ultimoEstado = estado;
          alunoStats[idAluno].ultimoEngaj = engaj;
          alunoStats[idAluno].dataUltima = r.data_registro || '';
        }

        eventosAlerta.push({
          data: r.data_registro || '',
          aluno: r.estudante_nome || 'Sem nome',
          turma: r.turma_nome || 'Sem turma',
          professor: r.prof_nome || 'Sem professor',
          habilidade: r.habilidade_trabalhada || '—',
          estado,
          engaj
        });
      }
    });

    const estadoRows = orderedRows(estadoCount, ORDEM_ESTADO);
    const engajRows = orderedRows(engajCount, ORDEM_ENGAJ);
    const matrizCols = engajRows.map((e) => e.label);
    const matrizRows = estadoRows.map((e) => e.label);

    const alunosRisco = Object.entries(alunoStats)
      .map(([key, a]) => {
        const total = totalAluno[key] || 0;
        const sinais = a.estado + a.engaj;
        return {
          ...a,
          total,
          sinais,
          pctSinais: total > 0 ? Math.round((sinais / total) * 100) : 0,
          indice: (a.estado * 2) + a.engaj
        };
      })
      .sort((a, b) => (b.indice - a.indice) || (b.pctSinais - a.pctSinais));

    eventosAlerta.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const sinaisDiretos = eventosAlerta
      .map((e) => ({
        data: e.data,
        aluno: e.aluno,
        turma: e.turma,
        professor: e.professor,
        estado: e.estado,
        engaj: e.engaj
      }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.aluno || '').localeCompare(b.aluno || ''));

    const comEstado = presentes.filter((r) => String(r.estado_emocional || '').trim()).length;
    const comEngaj = presentes.filter((r) => String(r.participacao || '').trim()).length;
    const completos = presentes.filter((r) => String(r.estado_emocional || '').trim() && String(r.participacao || '').trim()).length;

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${metricCard('Presenças no Período', presentes.length, 'user-check', 'green')}
        ${metricCard('Sinais de Atenção', eventosAlerta.length, 'triangle-alert', 'amber')}
        ${metricCard('Alunos com Sinal', alunosRisco.length, 'users-round', 'rose')}
        ${metricCard('Registros Completos', completos, 'clipboard-check', 'blue')}
      </div>
      <p class="text-[10px] font-bold text-gray-500 mb-6">Use esta tela para identificar rapidamente quais alunos precisam de conversa e acompanhamento imediato.</p>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="list-checks" class="w-4 h-4 text-amber-700"></i> Lista Direta de Sinais de Atenção
        </h3>
        ${renderListaSinaisDiretos(sinaisDiretos)}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="users-round" class="w-4 h-4 text-amber-600"></i> Alunos com Mais Sinais
          </h3>
          ${renderTabelaAlunos(alunosRisco)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="heart-pulse" class="w-4 h-4 text-rose-600"></i> Estado Emocional (Resumo)
          </h3>
          ${renderDistribuicao(estadoRows, presentes.length, 'bg-rose-500')}
        </div>
      </div>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="gauge" class="w-4 h-4 text-blue-600"></i> Engajamento (Resumo)
        </h3>
        ${renderDistribuicao(engajRows, presentes.length, 'bg-blue-500')}
      </div>
    `;
  }
}

function renderDistribuicao(rows, total, barClass) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados no período.</p>`;
  return `
    <div class="space-y-3">
      ${rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        return `
        <div>
          <div class="flex justify-between text-[11px] font-bold mb-1">
            <span>${esc(r.label)}</span>
            <span>${r.count} (${pct}%)</span>
          </div>
          <div class="w-full h-3 border border-black bg-gray-100">
            <div class="h-full ${barClass}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
      }).join('')}
    </div>
  `;
}

function renderMatriz(rows, cols, matriz, total) {
  if (rows.length === 0 || cols.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados para cruzamento.</p>`;

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full border-2 border-black text-[10px]">
        <thead>
          <tr class="bg-black text-white">
            <th class="p-2 text-left uppercase tracking-wider">Estado \\ Engaj.</th>
            ${cols.map((c) => `<th class="p-2 text-center uppercase tracking-wider">${esc(c)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="border-t border-black">
              <td class="p-2 font-black bg-gray-50">${esc(r)}</td>
              ${cols.map((c) => {
                const v = matriz?.[r]?.[c] || 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return `<td class="p-2 text-center font-bold">${v}<span class="text-gray-400"> (${pct}%)</span></td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTabelaAlunos(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Nenhum aluno com sinal de atenção no recorte.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((r) => `
        <div class="border-2 border-black p-2 bg-gray-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.nome)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${r.pctSinais >= 50 ? 'bg-red-200 text-red-900' : 'bg-amber-100 text-amber-900'}">${r.pctSinais}%</span>
          </div>
          <p class="text-[10px] font-bold text-gray-500">${esc(r.turma)} • ${r.sinais}/${r.total} sinais</p>
          <p class="text-[10px] font-bold text-gray-600">Último: ${esc(r.ultimoEstado)} • ${esc(r.ultimoEngaj)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderEventos(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem eventos de atenção no período.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((e) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(e.aluno)}</p>
            <span class="text-[10px] font-black">${formatDate(e.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-500">${esc(e.turma)} • ${esc(e.habilidade)}</p>
          <p class="text-[10px] font-bold mt-1">Estado: <span class="text-rose-700">${esc(e.estado)}</span></p>
          <p class="text-[10px] font-bold">Engajamento: <span class="text-blue-700">${esc(e.engaj)}</span></p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListaSinaisDiretos(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Nenhum sinal de atenção no período selecionado.</p>`;
  }

  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 60).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black">${formatDate(r.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.professor)}</p>
          <p class="text-[10px] font-bold mt-1">Estado: <span class="text-rose-700">${esc(r.estado)}</span></p>
          <p class="text-[10px] font-bold">Engajamento: <span class="text-blue-700">${esc(r.engaj)}</span></p>
        </div>
      `).join('')}
    </div>
  `;
}

function orderedRows(countMap, preferredOrder) {
  const rows = Object.entries(countMap).map(([label, count]) => ({ label, count }));
  const orderIndex = {};
  preferredOrder.forEach((k, idx) => { orderIndex[k] = idx; });

  rows.sort((a, b) => {
    const ai = orderIndex[a.label];
    const bi = orderIndex[b.label];
    const hasAi = ai !== undefined;
    const hasBi = bi !== undefined;
    if (hasAi && hasBi) return ai - bi;
    if (hasAi) return -1;
    if (hasBi) return 1;
    return a.label.localeCompare(b.label);
  });

  return rows;
}

function limpaEstado(v) {
  const txt = String(v || '').trim();
  return txt || 'Não informado';
}

function limpaEngaj(v) {
  const txt = String(v || '').trim();
  return txt || 'Não informado';
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
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Comportamento e Participação</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}
