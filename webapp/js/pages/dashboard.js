/**
 * 📈 DASHBOARD — Coordenação e Prof. Reforço
 * Mostra métricas reais do Firestore
 */

import { listarTurmas, listarEstudantes, listarProfsReforco, listarProfsRegentes } from '../db.js';

export async function renderDashboard(container, session) {
  const isCoord = session?.perfil === 'coordenacao';

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="border-b-4 border-black pb-4 mb-6">
        <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Dashboard</h2>
        <p class="text-gray-500 font-bold text-sm mt-1">${isCoord ? 'Visão panorâmica da Coordenação' : 'Seus indicadores do Reforço'}</p>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        ${mc('Carregando...', '—', 'loader', 'gray')}
        ${mc('Carregando...', '—', 'loader', 'gray')}
        ${mc('Carregando...', '—', 'loader', 'gray')}
        ${mc('Carregando...', '—', 'loader', 'gray')}
      </div>
    </div>`;

  // Load real data
  try {
    let [turmasData, estudantesData, profsR, profsG] = await Promise.all([
      listarTurmas(), listarEstudantes(), listarProfsReforco(), listarProfsRegentes()
    ]);

    if (!isCoord && session?.turmasIds) {
      turmasData = turmasData.filter(t => session.turmasIds.includes(String(t.id)));
      estudantesData = estudantesData.filter(e => session.turmasIds.includes(String(e.turma_id)));
    }

    const metricsHTML = `
      ${mc('Turmas', turmasData.length, 'school', 'blue')}
      ${mc('Estudantes', estudantesData.length, 'users', 'green')}
      ${mc('Prof. Reforço', profsR.length, 'book-open', 'purple')}
      ${mc('Prof. Regentes', profsG.length, 'briefcase', 'orange')}
    `;

    // Estudantes por etapa
    const etapaCount = {};
    estudantesData.forEach(e => {
      const et = e.etapa_nome || 'Sem Etapa';
      etapaCount[et] = (etapaCount[et] || 0) + 1;
    });

    // Estudantes por turma
    const turmaCount = {};
    estudantesData.forEach(e => {
      const tn = e.turma_nome || 'Sem Turma';
      turmaCount[tn] = (turmaCount[tn] || 0) + 1;
    });

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Dashboard</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">${isCoord ? 'Visão panorâmica da Coordenação' : 'Seus indicadores do Reforço'}</p>
        </div>

        <!-- METRICS -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">${metricsHTML}</div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- ESTUDANTES POR ETAPA -->
          <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <i data-lucide="bar-chart-2" class="w-4 h-4 text-blue-600"></i> Estudantes por Etapa
            </h3>
            <div class="space-y-3">
              ${Object.entries(etapaCount).map(([etapa, count]) => {
                const pct = Math.round((count / estudantesData.length) * 100) || 0;
                return `<div>
                  <div class="flex justify-between text-xs font-bold mb-1">
                    <span class="uppercase tracking-wider text-gray-600">${etapa}</span>
                    <span>${count} alunos (${pct}%)</span>
                  </div>
                  <div class="w-full bg-gray-200 h-4 border border-black">
                    <div class="bg-blue-500 h-full transition-all" style="width:${pct}%"></div>
                  </div>
                </div>`;
              }).join('')}
              ${Object.keys(etapaCount).length === 0 ? '<p class="text-xs text-gray-400 font-bold text-center py-4">Sem dados</p>' : ''}
            </div>
          </div>

          <!-- ESTUDANTES POR TURMA -->
          <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <i data-lucide="school" class="w-4 h-4 text-green-600"></i> Estudantes por Turma
            </h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              ${Object.entries(turmaCount).sort((a, b) => b[1] - a[1]).map(([turma, count]) => `
                <div class="flex items-center justify-between px-3 py-2 border-2 border-black bg-gray-50">
                  <span class="text-xs font-bold uppercase tracking-wider">${turma}</span>
                  <span class="text-xs font-black bg-black text-white px-2 py-0.5">${count}</span>
                </div>
              `).join('')}
              ${Object.keys(turmaCount).length === 0 ? '<p class="text-xs text-gray-400 font-bold text-center py-4">Sem dados</p>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function mc(label, value, icon, color) {
  return `<div class="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
    <div class="flex items-center gap-1.5 mb-1.5">
      <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400">${label}</span>
    </div>
    <p class="text-2xl font-black">${value}</p>
  </div>`;
}
