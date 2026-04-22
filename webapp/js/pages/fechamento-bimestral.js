/**
 * 📚 PAINEL DE FECHAMENTO BIMESTRAL — Coordenação
 * Consolida parecer, alta e ação pedagógica dos registros bimestrais.
 */

import { listarTurmas, listarEstudantes, listarProfsReforco, listarProfsRegentes, listarConsolidadosMensais } from '../db.js';

const BIMESTRES = ['I', 'II', 'III', 'IV'];
const PARECERES_PADRAO = ['Avançou bastante', 'Avançou parcialmente', 'Não conseguiu avançar (Estagnado)'];

export async function renderFechamentoBimestral(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let anoSel = now.getFullYear();
  let bimestreSel = 'I';
  let turmaSel = '';
  let profSel = '';
  let parecerSel = '';
  let carregou = false;

  let consolidados = [];
  let turmas = [];
  let estudantes = [];
  let profsReforco = [];
  let profsRegentes = [];

  const turmasMap = {};
  const estMap = {};
  const profRefMap = {};
  const profRegMap = {};

  container.innerHTML = loadingHTML();

  try {
    [turmas, estudantes, profsReforco, profsRegentes] = await Promise.all([
      listarTurmas(),
      listarEstudantes(null, true),
      listarProfsReforco(),
      listarProfsRegentes()
    ]);

    turmas.forEach((t) => { turmasMap[t.id] = t; });
    estudantes.forEach((e) => { estMap[e.id] = e; });
    profsReforco.forEach((p) => { profRefMap[p.id] = p; });
    profsRegentes.forEach((p) => { profRegMap[p.id] = p; });
  } catch (e) {
    console.error('Erro ao carregar base do fechamento bimestral:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);
    const pareceres = listarPareceres(consolidados);

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Fechamento Bimestral</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Parecer evolutivo, recomendação de alta e ação pedagógica por estudante.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="fb-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bimestre</label>
              <select id="fb-bimestre" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${BIMESTRES.map((b) => `<option value="${b}" ${b === bimestreSel ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="fb-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Professor de Reforço</label>
              <select id="fb-prof" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${profsReforco.map((p) => `<option value="${p.id}" ${String(p.id) === String(profSel) ? 'selected' : ''}>${esc(p.nome)} (${esc(p.area || 'Sem área')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Parecer</label>
              <select id="fb-parecer" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${pareceres.map((p) => `<option value="${escAttr(p)}" ${p === parecerSel ? 'selected' : ''}>${esc(p)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-fb-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="clipboard-check" class="w-4 h-4"></i> Analisar Fechamento
            </button>
          </div>
        </div>

        <div id="fb-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#fb-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#fb-bimestre')?.addEventListener('change', (e) => { bimestreSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fb-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fb-prof')?.addEventListener('change', (e) => { profSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fb-parecer')?.addEventListener('change', (e) => { parecerSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-fb-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-fb-analisar');
      btn.disabled = true;
      btn.innerHTML = 'Analisando...';
      await carregarConsolidados();
      renderPage();
    });
  }

  async function carregarConsolidados() {
    try {
      consolidados = await listarConsolidadosMensais();
      carregou = true;
    } catch (e) {
      console.error('Erro ao carregar consolidados_mensais:', e);
      consolidados = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="clipboard-check" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Analisar Fechamento"</p>
        </div>
      `;
    }

    const filtrados = aplicarFiltros(consolidados);
    if (filtrados.length === 0) {
      return `
        <div class="bg-white border-2 border-black p-6 text-center">
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Nenhum consolidado encontrado para os filtros.</p>
        </div>
      `;
    }

    return renderAnalise(filtrados);
  }

  function aplicarFiltros(rows) {
    let out = [...rows];

    out = out.filter((r) => String(r.data_registro || '').startsWith(`${anoSel}-`));
    out = out.filter((r) => String(r.bimestre || '') === String(bimestreSel));

    if (turmaSel) {
      out = out.filter((r) => String(estMap[r.estudante_id]?.turma_id || '') === String(turmaSel));
    }
    if (profSel) out = out.filter((r) => String(r.prof_id || '') === String(profSel));
    if (parecerSel) out = out.filter((r) => String(r.parecer_evolutivo || '') === parecerSel);

    return out.map((r) => {
      const est = estMap[r.estudante_id] || {};
      const pRef = profRefMap[r.prof_id] || {};
      const pReg = profRegMap[r.prof_regente_id] || {};
      return {
        ...r,
        estudante_nome: est.nome || 'Sem nome',
        turma_nome: est.turma_nome || 'Sem turma',
        etapa_nome: est.etapa_nome || '',
        prof_reforco_nome: pRef.nome || 'Sem professor',
        prof_reforco_area: pRef.area || '',
        prof_regente_nome: pReg.nome || 'Sem regente'
      };
    });
  }

  function renderAnalise(rows) {
    const total = rows.length;
    const altas = rows.filter((r) => isAlta(r.recomendacao_alta)).length;
    const semAlta = total - altas;
    const pctAlta = total > 0 ? Math.round((altas / total) * 100) : 0;
    const acoesPreenchidas = rows.filter((r) => String(r.acao_pedagogica || '').trim()).length;
    const estagnados = rows.filter((r) => isEstagnado(r.parecer_evolutivo)).length;

    const parecerCount = {};
    rows.forEach((r) => {
      const p = limpa(r.parecer_evolutivo, 'Não informado');
      parecerCount[p] = (parecerCount[p] || 0) + 1;
    });
    const parecerRows = Object.entries(parecerCount).map(([parecer, qtd]) => ({ parecer, qtd, pct: total > 0 ? Math.round((qtd / total) * 100) : 0 }))
      .sort((a, b) => b.qtd - a.qtd);

    const turmaMap = {};
    rows.forEach((r) => {
      const t = r.turma_nome || 'Sem turma';
      if (!turmaMap[t]) turmaMap[t] = { turma: t, total: 0, altas: 0, estagnados: 0 };
      turmaMap[t].total += 1;
      if (isAlta(r.recomendacao_alta)) turmaMap[t].altas += 1;
      if (isEstagnado(r.parecer_evolutivo)) turmaMap[t].estagnados += 1;
    });
    const turmasRows = Object.values(turmaMap).map((t) => ({
      ...t,
      pctAlta: t.total > 0 ? Math.round((t.altas / t.total) * 100) : 0,
      pctEstagnado: t.total > 0 ? Math.round((t.estagnados / t.total) * 100) : 0
    })).sort((a, b) => (b.estagnados - a.estagnados) || (a.pctAlta - b.pctAlta));

    const prioridades = rows
      .filter((r) => isEstagnado(r.parecer_evolutivo) || !String(r.acao_pedagogica || '').trim())
      .sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${metricCard('Fechamentos no Recorte', total, 'files', 'gray')}
        ${metricCard('Recomendados para Alta', `${altas} (${pctAlta}%)`, 'graduation-cap', 'green')}
        ${metricCard('Ações Pedagógicas Preenchidas', acoesPreenchidas, 'list-checks', 'blue')}
        ${metricCard('Casos Estagnados', estagnados, 'triangle-alert', estagnados > 0 ? 'amber' : 'gray')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="pie-chart" class="w-4 h-4 text-purple-600"></i> Distribuição de Parecer
          </h3>
          ${renderParecer(parecerRows)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="school" class="w-4 h-4 text-amber-600"></i> Fechamento por Turma
          </h3>
          ${renderTurmas(turmasRows)}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="siren" class="w-4 h-4 text-red-600"></i> Prioridades de Acompanhamento
          </h3>
          ${renderPrioridades(prioridades)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="table" class="w-4 h-4 text-blue-600"></i> Fechamentos Detalhados
          </h3>
          ${renderDetalhado(rows)}
        </div>
      </div>
    `;
  }
}

function renderParecer(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem pareceres no recorte.</p>`;
  return `
    <div class="space-y-3">
      ${rows.map((r) => `
        <div>
          <div class="flex justify-between text-[11px] font-bold mb-1">
            <span>${esc(r.parecer)}</span>
            <span>${r.qtd} (${r.pct}%)</span>
          </div>
          <div class="w-full h-3 border border-black bg-gray-100">
            <div class="h-full ${corParecer(r.parecer)}" style="width:${r.pct}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTurmas(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados por turma.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <p class="text-[11px] font-black truncate">${esc(r.turma)}</p>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <p class="text-[10px] font-bold text-gray-500">Total: <b>${r.total}</b></p>
            <p class="text-[10px] font-bold text-green-700">Alta: <b>${r.pctAlta}%</b></p>
            <p class="text-[10px] font-bold text-red-700">Estagnado: <b>${r.pctEstagnado}%</b></p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPrioridades(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Nenhuma prioridade no recorte.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((r) => `
        <div class="border-2 border-black p-2 bg-gray-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.estudante_nome)}</p>
            <span class="text-[10px] font-black">${formatDate(r.data_registro)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-500">${esc(r.turma_nome)} • ${esc(r.prof_reforco_nome)}</p>
          <p class="text-[10px] font-bold mt-1">Parecer: <span class="${isEstagnado(r.parecer_evolutivo) ? 'text-red-700' : 'text-gray-700'}">${esc(limpa(r.parecer_evolutivo, 'Não informado'))}</span></p>
          <p class="text-[10px] font-bold">Ação: ${String(r.acao_pedagogica || '').trim() ? esc(r.acao_pedagogica) : '<span class="text-amber-700">Não preenchida</span>'}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetalhado(rows) {
  return `
    <div class="overflow-x-auto max-h-96">
      <table class="min-w-full border border-black text-[10px]">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-2 text-left">Aluno</th>
            <th class="p-2 text-left">Turma</th>
            <th class="p-2 text-left">Parecer</th>
            <th class="p-2 text-center">Alta</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 80).map((r) => `
            <tr class="border-t border-black bg-white">
              <td class="p-2 font-bold">${esc(r.estudante_nome)}</td>
              <td class="p-2">${esc(r.turma_nome)}</td>
              <td class="p-2">${esc(limpa(r.parecer_evolutivo, 'Não informado'))}</td>
              <td class="p-2 text-center">${isAlta(r.recomendacao_alta) ? 'Sim' : 'Não'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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

function listarPareceres(rows) {
  const set = new Set(PARECERES_PADRAO);
  rows.forEach((r) => {
    const p = String(r?.parecer_evolutivo || '').trim();
    if (p) set.add(p);
  });
  return [...set];
}

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function isAlta(v) {
  return v === true || v === 1 || String(v).toLowerCase() === 'true';
}

function isEstagnado(parecer) {
  const p = String(parecer || '').toLowerCase();
  return p.includes('não conseguiu avançar') || p.includes('estagnado');
}

function limpa(v, fallback) {
  const txt = String(v || '').trim();
  return txt || fallback;
}

function corParecer(p) {
  const txt = String(p || '').toLowerCase();
  if (txt.includes('avançou bastante')) return 'bg-green-500';
  if (txt.includes('parcialmente')) return 'bg-blue-500';
  if (txt.includes('estagnado') || txt.includes('não conseguiu avançar')) return 'bg-red-500';
  return 'bg-gray-500';
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
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Fechamento Bimestral</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}
