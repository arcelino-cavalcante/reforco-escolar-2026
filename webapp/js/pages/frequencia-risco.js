/**
 * 🚨 PAINEL DE FALTAS — Coordenação
 * Mostra quem faltou e por qual motivo.
 */

import { listarTodosRegistrosMes, listarTurmas, listarProfsReforco } from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export async function renderFrequenciaRisco(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();
  let turmaSel = '';
  let profSel = '';
  let motivoSel = '';

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
    console.error('Erro ao carregar base do painel de frequência:', e);
  }

  renderPage();

  function renderPage() {
    const anos = buildAnos(anoSel);
    const motivos = listarMotivos(registrosMes);

    container.innerHTML = `
        <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Faltas</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Veja quem faltou e por qual motivo.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="fr-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="fr-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${anos.map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="fr-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas</option>
                ${turmas.map((t) => `<option value="${t.id}" ${String(t.id) === String(turmaSel) ? 'selected' : ''}>${esc(t.nome)} (${esc(t.etapa_nome || 'Sem etapa')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Professor</label>
              <select id="fr-prof" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${profs.map((p) => `<option value="${p.id}" ${String(p.id) === String(profSel) ? 'selected' : ''}>${esc(p.nome)} (${esc(p.area || 'Sem área')})</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Motivo da Falta</label>
              <select id="fr-motivo" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${motivos.map((m) => `<option value="${escAttr(m)}" ${m === motivoSel ? 'selected' : ''}>${esc(m)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="mt-4">
            <button id="btn-fr-analisar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="shield-alert" class="w-4 h-4"></i> Ver Faltas
            </button>
          </div>
        </div>

        <div id="fr-content">
          ${renderConteudo()}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#fr-mes')?.addEventListener('change', (e) => { mesSel = Number(e.target.value); });
    container.querySelector('#fr-ano')?.addEventListener('change', (e) => { anoSel = Number(e.target.value); });
    container.querySelector('#fr-turma')?.addEventListener('change', (e) => { turmaSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fr-prof')?.addEventListener('change', (e) => { profSel = e.target.value; if (carregou) renderPage(); });
    container.querySelector('#fr-motivo')?.addEventListener('change', (e) => { motivoSel = e.target.value; if (carregou) renderPage(); });

    container.querySelector('#btn-fr-analisar')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-fr-analisar');
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
      console.error('Erro ao carregar registros de frequência:', e);
      registrosMes = [];
      carregou = true;
    }
  }

  function renderConteudo() {
    if (!carregou) {
      return `
        <div class="text-center py-12 text-gray-400">
          <i data-lucide="calendar-check" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Selecione os filtros e clique em "Ver Faltas"</p>
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
      const nomeTurma = turmasMap[turmaSel]?.nome || '';
      out = out.filter((r) => (r.turma_nome || '') === nomeTurma);
    }
    if (profSel) out = out.filter((r) => String(r.prof_id || '') === String(profSel));
    if (motivoSel) out = out.filter((r) => !isPresent(r) && motivoFalha(r) === motivoSel);

    return out;
  }

  function renderAnalise(dados) {
    const faltas = dados.filter((r) => !isPresent(r));
    const presencas = dados.length - faltas.length;
    const freqPct = dados.length > 0 ? Math.round((presencas / dados.length) * 100) : 0;
    const alunosComFaltaSet = new Set(faltas.map((r) => String(r.estudante_id || '')));

    const motivoStats = {};
    faltas.forEach((r) => {
      const m = motivoFalha(r);
      motivoStats[m] = (motivoStats[m] || 0) + 1;
    });
    const motivosTop = Object.entries(motivoStats)
      .map(([motivo, qtd]) => ({ motivo, qtd, pct: faltas.length > 0 ? Math.round((qtd / faltas.length) * 100) : 0 }))
      .sort((a, b) => b.qtd - a.qtd);

    const alunoMap = {};
    dados.forEach((r) => {
      const aId = String(r.estudante_id || 'sem_id');
      if (!alunoMap[aId]) {
        alunoMap[aId] = {
          nome: r.estudante_nome || 'Sem nome',
          turma: r.turma_nome || 'Sem turma',
          total: 0,
          faltas: 0,
          motivos: {}
        };
      }
      alunoMap[aId].total += 1;

      if (!isPresent(r)) {
        const mf = motivoFalha(r);
        alunoMap[aId].faltas += 1;
        alunoMap[aId].motivos[mf] = (alunoMap[aId].motivos[mf] || 0) + 1;
      }
    });

    const alunos = Object.values(alunoMap)
      .map((a) => ({
        ...a,
        pctFalta: a.total > 0 ? Math.round((a.faltas / a.total) * 100) : 0,
        motivoTop: motivoPrincipal(a.motivos)
      }))
      .filter((a) => a.faltas > 0)
      .sort((a, b) => (b.faltas - a.faltas) || (b.pctFalta - a.pctFalta));

    const alunosReincidentes = alunos.filter((a) => a.faltas >= 2);
    const faltasDetalhadas = faltas
      .map((r) => ({
        data: r.data_registro || '',
        aluno: r.estudante_nome || 'Sem nome',
        turma: r.turma_nome || 'Sem turma',
        professor: r.prof_nome || 'Sem professor',
        motivo: motivoFalha(r)
      }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.aluno || '').localeCompare(b.aluno || ''));

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        ${metricCard('Registros no Período', dados.length, 'file-text', 'gray')}
        ${metricCard('Faltas', faltas.length, 'x-circle', 'red')}
        ${metricCard('Alunos Que Faltaram', alunosComFaltaSet.size, 'user-x', 'amber')}
        ${metricCard('Reincidentes (2+ faltas)', alunosReincidentes.length, 'siren', 'blue')}
      </div>
      <p class="text-[10px] font-bold text-gray-500 mb-6">Frequência geral no período: <span class="text-black">${freqPct}%</span></p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="list-filter" class="w-4 h-4 text-red-600"></i> Quem Faltou e Motivo
          </h3>
          ${renderTabelaFaltasDetalhadas(faltasDetalhadas)}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="alert-circle" class="w-4 h-4 text-red-600"></i> Resumo por Motivo
          </h3>
          ${motivosTop.length === 0 ? `<p class="text-xs font-bold text-gray-400">Sem faltas registradas no recorte.</p>` : `
            <div class="space-y-3">
              ${motivosTop.slice(0, 8).map((m) => `
                <div>
                  <div class="flex justify-between text-[11px] font-bold mb-1">
                    <span class="text-gray-700">${esc(m.motivo)}</span>
                    <span>${m.qtd} (${m.pct}%)</span>
                  </div>
                  <div class="w-full h-3 border border-black bg-gray-100">
                    <div class="h-full bg-red-500" style="width:${m.pct}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="siren" class="w-4 h-4 text-amber-600"></i> Alunos com Mais Faltas
        </h3>
        ${renderTabelaAlunos(alunos)}
      </div>
    `;
  }
}

function renderTabelaAlunos(alunos) {
  if (alunos.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem reincidência no recorte atual.</p>`;
  }

  return `
    <div class="space-y-2 max-h-80 overflow-y-auto">
      ${alunos.slice(0, 20).map((a) => `
        <div class="border-2 border-black p-2 bg-gray-50">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-black truncate">${esc(a.nome)}</p>
            <span class="text-[10px] font-black px-2 py-0.5 border border-black ${a.pctFalta >= 50 ? 'bg-red-200 text-red-900' : 'bg-amber-100 text-amber-900'}">${a.pctFalta}%</span>
          </div>
          <p class="text-[10px] font-bold text-gray-500">${esc(a.turma)} • ${a.faltas}/${a.total} faltas</p>
          <p class="text-[10px] font-bold text-gray-600 mt-1">Motivo recorrente: ${esc(a.motivoTop)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTabelaFaltasDetalhadas(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem faltas registradas no período selecionado.</p>`;
  }

  return `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${rows.slice(0, 40).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black bg-red-200 text-red-900">${formatDate(r.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.professor)}</p>
          <p class="text-[10px] font-bold text-gray-700 mt-1">Motivo: ${esc(r.motivo)}</p>
        </div>
      `).join('')}
    </div>
    <p class="text-[10px] font-bold text-gray-500 mt-2">Mostrando até 40 faltas no detalhe.</p>
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

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function listarMotivos(regs) {
  const set = new Set();
  regs.forEach((r) => {
    if (!isPresent(r)) set.add(motivoFalha(r));
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function motivoFalha(r) {
  return String(r?.motivo_falta || 'Sem motivo informado').trim() || 'Sem motivo informado';
}

function motivoPrincipal(motivos) {
  const rows = Object.entries(motivos || {}).sort((a, b) => b[1] - a[1]);
  return rows[0]?.[0] || 'Sem motivo informado';
}

function isPresent(r) {
  return r?.compareceu === 1 || r?.compareceu === true || r?.presente === 1 || r?.presente === true;
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
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Faltas</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}

function formatDate(iso) {
  const raw = String(iso || '');
  if (!raw || !raw.includes('-')) return 'Sem data';
  const [yyyy, mm, dd] = raw.split('-');
  if (!yyyy || !mm || !dd) return raw;
  return `${dd}/${mm}/${yyyy}`;
}
