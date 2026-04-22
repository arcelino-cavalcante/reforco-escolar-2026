/**
 * 🔄 PAINEL DE FLUXO DE ENCAMINHAMENTOS — Coordenação
 * Acompanha PENDENTE/ATENDIDO/LIDO e tempo de resposta.
 */

import { listarTurmas, listarEstudantes, listarProfsRegentes, listarEncaminhamentos } from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const STATUS_ORDER = ['PENDENTE', 'ATENDIDO_PELO_REFORCO', 'LIDO_PELO_REGENTE'];

export async function renderFluxoEncaminhamentos(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();
  let statusSel = '';
  let turmaSel = '';
  let areaSel = '';
  let regenteSel = '';
  let carregou = false;

  let encaminhamentos = [];
  let turmas = [];
  let estudantes = [];
  let regentes = [];
  const estMap = {};
  const regMap = {};
  const turmasMap = {};

  container.innerHTML = loadingHTML();

  try {
    [turmas, estudantes, regentes] = await Promise.all([
      listarTurmas(),
      listarEstudantes(null, true),
      listarProfsRegentes()
    ]);

    turmas.forEach((t) => { turmasMap[t.id] = t; });
    estudantes.forEach((e) => { estMap[e.id] = e; });
    regentes.forEach((r) => { regMap[r.id] = r; });
  } catch (e) {
    console.error('Erro ao carregar base do fluxo de encaminhamentos:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);
    const areas = listarAreas(encaminhamentos);

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Fluxo de Encaminhamentos</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Funil de status, tempo de resposta e pendências críticas.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="fe-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="fe-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Status</label>
              <select id="fe-status" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${STATUS_ORDER.map((s) => `<option value="${s}" ${s === statusSel ? 'selected' : ''}>${statusLabel(s)}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="fe-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Área Alvo</label>
              <select id="fe-area" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${areas.map((a) => `<option value="${escAttr(a)}" ${a === areaSel ? 'selected' : ''}>${esc(a)}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Regente</label>
              <select id="fe-regente" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${regentes.map((r) => `<option value="${r.id}" ${String(r.id) === String(regenteSel) ? 'selected' : ''}>${esc(r.nome)} (${esc(r.area || 'Sem área')})</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-fe-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="git-pull-request-arrow" class="w-4 h-4"></i> Analisar Fluxo
            </button>
          </div>
        </div>

        <div id="fe-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#fe-mes')?.addEventListener('change', (e) => { mesSel = Number(e.target.value); });
    container.querySelector('#fe-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#fe-status')?.addEventListener('change', (e) => { statusSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fe-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fe-area')?.addEventListener('change', (e) => { areaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fe-regente')?.addEventListener('change', (e) => { regenteSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-fe-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-fe-analisar');
      btn.disabled = true;
      btn.innerHTML = 'Analisando...';
      await carregarEncaminhamentos();
      renderPage();
    });
  }

  async function carregarEncaminhamentos() {
    try {
      encaminhamentos = await listarEncaminhamentos();
      carregou = true;
    } catch (e) {
      console.error('Erro ao carregar encaminhamentos:', e);
      encaminhamentos = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="git-pull-request-arrow" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Analisar Fluxo"</p>
        </div>
      `;
    }

    const filtrados = aplicarFiltros(encaminhamentos);
    if (filtrados.length === 0) {
      return `
        <div class="bg-white border-2 border-black p-6 text-center">
          <p class="font-black text-sm uppercase tracking-wider text-gray-500">Nenhum encaminhamento encontrado para os filtros.</p>
        </div>
      `;
    }

    return renderAnalise(filtrados);
  }

  function aplicarFiltros(rows) {
    let out = [...rows];
    const mesRef = String(mesSel).padStart(2, '0');

    out = out.filter((r) => String(r.data_solicitacao || '').startsWith(`${anoSel}-${mesRef}-`));
    if (statusSel) out = out.filter((r) => normalizaStatus(r.status) === statusSel);
    if (areaSel) out = out.filter((r) => String(r.alvo_area || '') === areaSel);
    if (regenteSel) out = out.filter((r) => String(r.regente_id || '') === String(regenteSel));
    if (turmaSel) out = out.filter((r) => String(estMap[r.estudante_id]?.turma_id || '') === String(turmaSel));

    return out.map((r) => {
      const est = estMap[r.estudante_id] || {};
      const reg = regMap[r.regente_id] || {};
      const status = normalizaStatus(r.status);
      const tempoResposta = calcDias(r.data_solicitacao, r.data_conclusao);
      const idadePendente = status === 'PENDENTE' ? calcDias(r.data_solicitacao, todayIso()) : null;
      return {
        ...r,
        status_norm: status,
        aluno_nome: est.nome || 'Sem nome',
        turma_nome: est.turma_nome || 'Sem turma',
        regente_nome: reg.nome || 'Sem regente',
        regente_area: reg.area || '',
        tempo_resposta: tempoResposta,
        idade_pendente: idadePendente
      };
    });
  }

  function renderAnalise(rows) {
    const total = rows.length;
    const pendentes = rows.filter((r) => r.status_norm === 'PENDENTE');
    const atendidos = rows.filter((r) => r.status_norm === 'ATENDIDO_PELO_REFORCO');
    const lidos = rows.filter((r) => r.status_norm === 'LIDO_PELO_REGENTE');
    const concluidos = rows.filter((r) => r.status_norm !== 'PENDENTE');

    const tempos = concluidos.map((r) => r.tempo_resposta).filter((d) => Number.isFinite(d));
    const tempoMedio = tempos.length > 0 ? (tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
    const pendentesCriticos = pendentes.filter((r) => (r.idade_pendente || 0) >= 7);

    const statusRows = STATUS_ORDER.map((s) => {
      const qtd = rows.filter((r) => r.status_norm === s).length;
      return { status: s, qtd, pct: total > 0 ? Math.round((qtd / total) * 100) : 0 };
    });

    const areaMap = {};
    rows.forEach((r) => {
      const area = limpa(r.alvo_area, 'Não informado');
      if (!areaMap[area]) areaMap[area] = { area, total: 0, pendentes: 0, tempo: [] };
      areaMap[area].total += 1;
      if (r.status_norm === 'PENDENTE') areaMap[area].pendentes += 1;
      if (Number.isFinite(r.tempo_resposta)) areaMap[area].tempo.push(r.tempo_resposta);
    });
    const areaRows = Object.values(areaMap).map((a) => ({
      ...a,
      pctPend: a.total > 0 ? Math.round((a.pendentes / a.total) * 100) : 0,
      tempoMedio: a.tempo.length > 0 ? (a.tempo.reduce((x, y) => x + y, 0) / a.tempo.length) : null
    })).sort((a, b) => b.pctPend - a.pctPend);

    pendentes.sort((a, b) => (b.idade_pendente || 0) - (a.idade_pendente || 0));
    concluidos.sort((a, b) => (b.data_conclusao || '').localeCompare(a.data_conclusao || ''));

    return `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        ${metricCard('Total no Período', total, 'git-pull-request-arrow', 'gray')}
        ${metricCard('Pendentes', pendentes.length, 'clock-3', pendentes.length > 0 ? 'amber' : 'gray')}
        ${metricCard('Atendidos', atendidos.length, 'circle-check', 'blue')}
        ${metricCard('Lidos', lidos.length, 'eye', 'green')}
        ${metricCard('Tempo Médio de Resposta', tempoMedio === null ? 'N/D' : `${tempoMedio.toFixed(1)} dias`, 'timer', 'purple')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="funnel" class="w-4 h-4 text-blue-600"></i> Funil por Status
          </h3>
          ${renderFunil(statusRows)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600"></i> Pendências Críticas (>= 7 dias)
          </h3>
          ${renderPendenciasCriticas(pendentesCriticos)}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="layers-3" class="w-4 h-4 text-purple-600"></i> Backlog por Área Alvo
          </h3>
          ${renderBacklogArea(areaRows)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="list-checks" class="w-4 h-4 text-green-600"></i> Fluxo Recente (Top 40)
          </h3>
          ${renderFluxoRecente(rows)}
        </div>
      </div>
    `;
  }
}

function renderFunil(rows) {
  return `
    <div class="space-y-3">
      ${rows.map((r) => `
        <div>
          <div class="flex justify-between text-[11px] font-bold mb-1">
            <span>${statusLabel(r.status)}</span>
            <span>${r.qtd} (${r.pct}%)</span>
          </div>
          <div class="w-full h-3 border border-black bg-gray-100">
            <div class="h-full ${statusBarColor(r.status)}" style="width:${r.pct}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPendenciasCriticas(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Nenhuma pendência crítica neste recorte.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 20).map((r) => `
        <div class="border-2 border-black p-2 bg-red-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno_nome)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black bg-red-200 text-red-900">${r.idade_pendente}d</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma_nome)} • ${esc(r.alvo_area || 'Sem área')}</p>
          <p class="text-[10px] font-bold text-gray-500">Regente: ${esc(r.regente_nome)}</p>
          <p class="text-[10px] font-bold text-gray-500">Solicitado em: ${formatDate(r.data_solicitacao)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBacklogArea(rows) {
  if (rows.length === 0) return `<p class="text-xs font-bold text-gray-400">Sem dados de área no período.</p>`;
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.area)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${r.pctPend >= 40 ? 'bg-red-200 text-red-900' : 'bg-amber-100 text-amber-900'}">${r.pctPend}% pend.</span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-1">
            <p class="text-[10px] font-bold text-gray-500">Total: <b>${r.total}</b></p>
            <p class="text-[10px] font-bold text-gray-500">Pend.: <b>${r.pendentes}</b></p>
            <p class="text-[10px] font-bold text-gray-500">TMR: <b>${r.tempoMedio === null ? 'N/D' : `${r.tempoMedio.toFixed(1)}d`}</b></p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFluxoRecente(rows) {
  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 40).sort((a, b) => (b.data_solicitacao || '').localeCompare(a.data_solicitacao || '')).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno_nome)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${statusBadge(r.status_norm)}">${statusLabel(r.status_norm)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma_nome)} • ${esc(r.alvo_area || 'Sem área')}</p>
          <p class="text-[10px] font-bold text-gray-500">Regente: ${esc(r.regente_nome)}</p>
          <p class="text-[10px] font-bold text-gray-500">
            Solicitação: ${formatDate(r.data_solicitacao)}
            ${r.data_conclusao ? ` • Conclusão: ${formatDate(r.data_conclusao)}` : ''}
            ${Number.isFinite(r.tempo_resposta) ? ` • ${r.tempo_resposta}d` : ''}
          </p>
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

function listarAreas(rows) {
  const set = new Set();
  rows.forEach((r) => {
    const a = String(r?.alvo_area || '').trim();
    if (a) set.add(a);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function normalizaStatus(status) {
  const s = String(status || '').toUpperCase().trim();
  if (s.includes('LIDO')) return 'LIDO_PELO_REGENTE';
  if (s.includes('ATENDIDO')) return 'ATENDIDO_PELO_REFORCO';
  if (s.includes('PENDENTE')) return 'PENDENTE';
  return 'PENDENTE';
}

function statusLabel(status) {
  if (status === 'PENDENTE') return 'Pendente';
  if (status === 'ATENDIDO_PELO_REFORCO') return 'Atendido pelo Reforço';
  if (status === 'LIDO_PELO_REGENTE') return 'Lido pelo Regente';
  return status || 'Pendente';
}

function statusBarColor(status) {
  if (status === 'PENDENTE') return 'bg-amber-500';
  if (status === 'ATENDIDO_PELO_REFORCO') return 'bg-blue-500';
  if (status === 'LIDO_PELO_REGENTE') return 'bg-green-500';
  return 'bg-gray-500';
}

function statusBadge(status) {
  if (status === 'PENDENTE') return 'bg-amber-200 text-amber-900';
  if (status === 'ATENDIDO_PELO_REFORCO') return 'bg-blue-200 text-blue-900';
  if (status === 'LIDO_PELO_REGENTE') return 'bg-green-200 text-green-900';
  return 'bg-gray-200 text-gray-900';
}

function calcDias(dataIni, dataFim) {
  const ini = parseDateOnly(dataIni);
  const fim = parseDateOnly(dataFim);
  if (!ini || !fim) return null;
  const diff = fim.getTime() - ini.getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function parseDateOnly(v) {
  const txt = String(v || '').trim();
  if (!txt) return null;
  const parts = txt.split('-');
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function todayIso() {
  const dt = new Date();
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function limpa(v, fallback) {
  const txt = String(v || '').trim();
  return txt || fallback;
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
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Fluxo de Encaminhamentos</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}
