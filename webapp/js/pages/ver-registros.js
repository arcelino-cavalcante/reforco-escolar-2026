/**
 * 📋 VER REGISTROS — Coordenação
 * Lista todos os registros diários do mês selecionado
 */

import { listarTodosRegistrosMes } from '../db.js';

export async function renderVerRegistros(container, session) {
  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();

  container.innerHTML = loadingHTML();
  await loadAndRender();

  async function loadAndRender() {
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Ver Registros</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Todos os lançamentos diários do sistema</p>
        </div>

        <!-- FILTRO MÊS/ANO -->
        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="filtro-mes" class="border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m === mesSel ? 'selected' : ''}>${nomesMes[m-1]}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="filtro-ano" class="border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${[2025, 2026, 2027].map(a => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <button id="btn-buscar-regs" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="search" class="w-4 h-4"></i> Buscar
            </button>
          </div>
        </div>

        <div id="regs-result">
          <div class="text-center py-8"><div class="h-8 w-8 mx-auto skeleton rounded-full mb-2"></div><p class="text-xs font-bold text-gray-400">Carregando registros...</p></div>
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons();

    // Events
    container.querySelector('#btn-buscar-regs')?.addEventListener('click', async () => {
      mesSel = parseInt(container.querySelector('#filtro-mes').value);
      anoSel = parseInt(container.querySelector('#filtro-ano').value);
      await fetchAndShow();
    });

    await fetchAndShow();
  }

  async function fetchAndShow() {
    const resultDiv = container.querySelector('#regs-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div class="text-center py-8"><div class="h-6 skeleton rounded w-40 mx-auto"></div></div>';

    try {
      const regs = await listarTodosRegistrosMes(mesSel, anoSel);

      if (regs.length === 0) {
        resultDiv.innerHTML = `<div class="text-center py-12 text-gray-400">
          <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-xs font-bold uppercase tracking-wider">Nenhum registro encontrado em ${nomesMes[mesSel-1]}/${anoSel}</p>
        </div>`;
        if (window.lucide) lucide.createIcons();
        return;
      }

      // Group by date
      const byDate = {};
      regs.forEach(r => {
        const d = r.data_registro || 'Sem data';
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(r);
      });

      resultDiv.innerHTML = `
        <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
          <h3 class="text-xs font-black uppercase tracking-wider">Resultados</h3>
          <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">${regs.length} registros</span>
        </div>
        <div class="space-y-4">
          ${Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([data, items]) => `
            <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div class="bg-black text-white px-3 py-2 flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <i data-lucide="calendar" class="w-4 h-4 text-yellow-400"></i> ${formatDate(data)}
                </span>
                <span class="text-[10px] font-bold text-gray-300">${items.length} lançamentos</span>
              </div>
              <div class="divide-y divide-gray-200">
                ${items.map((r) => {
                  const isPresent = r.compareceu === 1 || r.compareceu === true || r.presente === 1 || r.presente === true;
                  return `
                    <div class="px-3 py-2 flex items-center gap-3 text-xs">
                      <span class="font-black w-1/3 truncate">${r.estudante_nome || '—'}</span>
                      <span class="font-bold text-gray-500 w-1/4 truncate">${r.turma_nome || '—'}</span>
                      <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase border border-black ${isPresent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${isPresent ? 'Presente' : 'Falta'}</span>
                      <span class="font-bold text-gray-400 truncate flex-1 text-right">${r.prof_nome || ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>`;
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Erro ao buscar registros:', err);
      resultDiv.innerHTML = `<p class="text-xs font-bold text-red-600 text-center py-8">Erro ao buscar registros: ${err.message}</p>`;
    }
  }
}

function loadingHTML() {
  return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Ver Registros</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}

function formatDate(d) {
  if (!d || d === 'Sem data') return d;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const nomesMes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
