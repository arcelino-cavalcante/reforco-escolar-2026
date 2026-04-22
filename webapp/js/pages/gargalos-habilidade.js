/**
 * 🎯 PAINEL DE GARGALOS DE HABILIDADE — Coordenação
 * Cruza habilidade trabalhada, dificuldade latente e nível de compreensão.
 */

import { listarTodosRegistrosMes, listarTurmas, compreensaoParaNota, compreensaoLabel } from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export async function renderGargalosHabilidade(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();
  let turmaSel = '';
  let areaSel = '';
  let carregou = false;

  let registrosMes = [];
  let turmas = [];
  const turmasMap = {};

  container.innerHTML = loadingHTML();

  try {
    turmas = await listarTurmas();
    turmas.forEach((t) => { turmasMap[t.id] = t; });
  } catch (e) {
    console.error('Erro ao carregar turmas para gargalos:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);
    const areas = listarAreas(registrosMes);

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Habilidades com Dificuldade</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Veja quais habilidades estão mais difíceis para os alunos.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="gh-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="gh-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="gh-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Disciplina</label>
              <select id="gh-area" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${areas.map((a) => `<option value="${escAttr(a)}" ${a === areaSel ? 'selected' : ''}>${esc(a)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-gh-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="target" class="w-4 h-4"></i> Ver Dificuldades
            </button>
          </div>
        </div>

        <div id="gh-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#gh-mes')?.addEventListener('change', (e) => { mesSel = Number(e.target.value); });
    container.querySelector('#gh-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#gh-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#gh-area')?.addEventListener('change', (e) => { areaSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-gh-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-gh-analisar');
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
      console.error('Erro ao carregar registros para gargalos:', e);
      registrosMes = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="bar-chart-3" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Ver Dificuldades"</p>
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
    if (areaSel) {
      const areaNorm = areaSel.toLowerCase();
      out = out.filter((r) => String(r.prof_area || '').toLowerCase() === areaNorm);
    }

    return out;
  }

  function renderAnalise(dados) {
    const presentes = dados.filter((r) => isPresent(r));
    const validos = presentes.filter((r) => String(r.habilidade_trabalhada || '').trim());

    if (validos.length === 0) {
      return `
        <div class="bg-white border-2 border-black p-6 text-center">
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Não há habilidades registradas nesse recorte.</p>
        </div>
      `;
    }

    const habMap = {};
    const difMap = {};
    const casosCriticos = [];

    validos.forEach((r) => {
      const habilidade = String(r.habilidade_trabalhada || '').trim();
      const nota = compreensaoParaNota(r.nivel_compreensao ?? 0);
      const dif = String(r.dificuldade_latente || '').trim();
      const temDif = dif.length > 0;

      if (!habMap[habilidade]) {
        habMap[habilidade] = {
          habilidade,
          total: 0,
          somaNota: 0,
          qtdNota: 0,
          baixaComp: 0,
          qtdDif: 0
        };
      }

      habMap[habilidade].total += 1;
      if (nota > 0) {
        habMap[habilidade].somaNota += nota;
        habMap[habilidade].qtdNota += 1;
        if (nota <= 2) habMap[habilidade].baixaComp += 1;
      }
      if (temDif) habMap[habilidade].qtdDif += 1;

      if (temDif) {
        const key = normalizaTexto(dif);
        if (!difMap[key]) difMap[key] = { texto: dif, qtd: 0 };
        difMap[key].qtd += 1;
      }

      if (temDif || (nota > 0 && nota <= 2)) {
        casosCriticos.push({
          data: r.data_registro || '',
          aluno: r.estudante_nome || 'Sem nome',
          turma: r.turma_nome || 'Sem turma',
          habilidade,
          comp: compreensaoLabel(r.nivel_compreensao ?? 0),
          dif: dif || '—'
        });
      }
    });

    const habRows = Object.values(habMap).map((h) => {
      const media = h.qtdNota > 0 ? (h.somaNota / h.qtdNota) : 0;
      const pctDif = h.total > 0 ? (h.qtdDif / h.total) * 100 : 0;
      const pctBaixa = h.qtdNota > 0 ? (h.baixaComp / h.qtdNota) * 100 : 0;
      const mediaPct = media > 0 ? (media / 4) * 100 : 0;
      const risco = ((100 - mediaPct) * 0.5) + (pctDif * 0.3) + (pctBaixa * 0.2);
      return {
        ...h,
        media,
        pctDif: Math.round(pctDif),
        pctBaixa: Math.round(pctBaixa),
        risco: Math.round(risco)
      };
    }).sort((a, b) => b.risco - a.risco);

    const difRows = Object.values(difMap).sort((a, b) => b.qtd - a.qtd);
    const qtdCriticas = habRows.filter((h) => h.risco >= 55).length;
    const qtdComDif = habRows.reduce((acc, h) => acc + h.qtdDif, 0);
    const alunosComDificuldade = casosCriticos
      .map((c) => ({
        data: c.data,
        aluno: c.aluno,
        turma: c.turma,
        habilidade: c.habilidade,
        comp: c.comp,
        dif: c.dif
      }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.aluno || '').localeCompare(b.aluno || ''));

    casosCriticos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${metricCard('Registros Válidos', validos.length, 'file-check-2', 'gray')}
        ${metricCard('Habilidades Únicas', habRows.length, 'list-checks', 'blue')}
        ${metricCard('Habilidades Críticas', qtdCriticas, 'triangle-alert', 'red')}
        ${metricCard('Com Dificuldade Latente', qtdComDif, 'siren', 'amber')}
      </div>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="list-todo" class="w-4 h-4 text-red-600"></i> Alunos com Dificuldade (Lista Direta)
        </h3>
        ${renderListaAlunosDificuldade(alunosComDificuldade)}
      </div>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="target" class="w-4 h-4 text-red-600"></i> Ranking de Gargalos por Habilidade
        </h3>
        ${renderTabelaHabilidades(habRows)}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="message-square-warning" class="w-4 h-4 text-amber-600"></i> Dificuldades Latentes Mais Citadas
          </h3>
          ${renderTabelaDificuldades(difRows)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="history" class="w-4 h-4 text-purple-600"></i> Casos Críticos Recentes
          </h3>
          ${renderTabelaCasos(casosCriticos)}
        </div>
      </div>
    `;
  }
}

function renderTabelaHabilidades(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados suficientes.</p>`;

  return `
    <div class="space-y-1.5 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((h) => `
        <div class="border-2 border-black p-2 bg-gray-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(h.habilidade)}</p>
            <span class="text-[10px] font-black px-2 py-0.5 border border-black ${badgeRisco(h.risco)}">Risco ${h.risco}</span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <p class="text-[10px] font-bold text-gray-500">Registros: <b>${h.total}</b></p>
            <p class="text-[10px] font-bold text-gray-500">Média comp.: <b>${h.media.toFixed(1)}/4</b></p>
            <p class="text-[10px] font-bold text-gray-500">Baixa comp.: <b>${h.pctBaixa}%</b></p>
          </div>
          <p class="text-[10px] font-bold text-gray-600 mt-1">Dificuldade latente: <b>${h.pctDif}%</b></p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListaAlunosDificuldade(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Nenhum aluno com dificuldade no período.</p>`;
  }

  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 60).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black">${formatDate(r.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.habilidade)}</p>
          <p class="text-[10px] font-bold mt-1">Compreensão: <span class="text-red-700">${esc(r.comp)}</span></p>
          <p class="text-[10px] font-bold text-gray-700">Dificuldade: ${esc(r.dif)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTabelaDificuldades(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Nenhuma dificuldade latente preenchida.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((d) => `
        <div class="border border-black bg-gray-50 px-2 py-1.5 flex items-start justify-between gap-2">
          <p class="text-[11px] font-bold text-gray-700">${esc(d.texto)}</p>
          <span class="text-[10px] font-black px-1.5 py-0.5 border border-black bg-amber-100 text-amber-900">${d.qtd}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTabelaCasos(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem casos críticos no período.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((c) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(c.aluno)}</p>
            <span class="text-[10px] font-black">${formatDate(c.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-500">${esc(c.turma)} • ${esc(c.habilidade)}</p>
          <p class="text-[10px] font-bold mt-1">Compreensão: <span class="text-red-700">${esc(c.comp)}</span></p>
          <p class="text-[10px] font-bold text-gray-600">Dificuldade: ${esc(c.dif)}</p>
        </div>
      `).join('')}
    </div>
  `;
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

function badgeRisco(risco) {
  if (risco >= 70) return 'bg-red-200 text-red-900';
  if (risco >= 55) return 'bg-amber-200 text-amber-900';
  return 'bg-green-100 text-green-900';
}

function listarAreas(regs) {
  const set = new Set();
  regs.forEach((r) => {
    const area = String(r.prof_area || '').trim();
    if (area) set.add(area);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function normalizaTexto(v) {
  return String(v || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
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

function escAttr(v) {
  return esc(v).replace(/"/g, '&quot;');
}

function loadingHTML() {
  return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Habilidades com Dificuldade</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}
