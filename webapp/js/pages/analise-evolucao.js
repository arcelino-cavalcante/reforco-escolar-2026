/**
 * 📊 ANÁLISE DE EVOLUÇÃO — Coordenação
 * Visão global da evolução dos estudantes
 */

import {
  listarTurmas,
  listarEstudantes,
  listarProfsReforco,
  listarRegistrosDiariosTodos,
  compreensaoParaNota
} from '../db.js';

const ESCALA_NOMES = [
  'Não compreendeu a habilidade',
  'Compreendeu com muita intervenção',
  'Compreendeu com pouca intervenção',
  'Autônomo (Domínio total)'
];
const ESCALA_CORES = ['red', 'orange', 'blue', 'green'];

export async function renderAnaliseEvolucao(container, session) {
  let turmas = [], estudantes = [], profsR = [];
  let selTurma = '';
  let registros = [];

  container.innerHTML = `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Análise de Evolução</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;

  try {
    [turmas, estudantes, profsR] = await Promise.all([
      listarTurmas(), listarEstudantes(), listarProfsReforco()
    ]);
  } catch (e) { console.error(e); }

  renderPage();

  function renderPage() {
    const alunosTurma = selTurma ? estudantes.filter(e => e.turma_id === selTurma) : estudantes;

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Análise de Evolução</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Visão global da evolução no reforço escolar</p>
        </div>

        <!-- FILTRO -->
        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="flex flex-wrap items-end gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Filtrar por Turma</label>
              <select id="analise-turma" class="border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas as Turmas</option>
                ${turmas.map(t => `<option value="${t.id}" ${selTurma === t.id ? 'selected' : ''}>${t.nome} (${t.etapa_nome})</option>`).join('')}
              </select>
            </div>
            <button id="btn-analise" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
              <i data-lucide="bar-chart-2" class="w-4 h-4"></i> Analisar
            </button>
          </div>
        </div>

        <div id="analise-result">
          ${registros.length > 0 ? renderAnalysis(alunosTurma) : renderGuide()}
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons();

    container.querySelector('#analise-turma')?.addEventListener('change', (e) => {
      selTurma = e.target.value;
    });
    container.querySelector('#btn-analise')?.addEventListener('click', async () => {
      await fetchRegistros();
      renderPage();
    });
  }

  async function fetchRegistros() {
    try {
      const todos = await listarRegistrosDiariosTodos();
      if (!selTurma) {
        registros = todos;
        return;
      }
      const alIds = new Set(estudantes.filter((e) => e.turma_id === selTurma).map((e) => e.id));
      registros = todos.filter((r) => alIds.has(String(r.estudante_id || '')));
    } catch (e) { console.error(e); registros = []; }
  }

  function renderAnalysis(alunosTurma) {
    if (registros.length === 0) return renderGuide();

    const isPresent = (r) => r.compareceu === 1 || r.compareceu === true || r.presente === 1 || r.presente === true;
    const presentes = registros.filter((r) => isPresent(r));
    const pctFreq = registros.length > 0 ? Math.round((presentes.length / registros.length) * 100) : 0;

    // Distribuição de compreensão
    const dist = {};
    ESCALA_NOMES.forEach(n => dist[n] = 0);
    presentes.forEach((r) => {
      const nota = compreensaoParaNota(r.nivel_compreensao || 0);
      if (nota >= 1 && nota <= 4) {
        dist[ESCALA_NOMES[nota - 1]]++;
      }
    });

    // Ranking por aluno
    const alunoStats = {};
    const estMap = {};
    estudantes.forEach(e => { estMap[e.id] = e; });

    presentes.forEach((r) => {
      if (!alunoStats[r.estudante_id]) alunoStats[r.estudante_id] = { total: 0, soma: 0 };
      const v = compreensaoParaNota(r.nivel_compreensao || 0);
      if (v > 0) { alunoStats[r.estudante_id].total++; alunoStats[r.estudante_id].soma += v; }
    });

    const ranking = Object.entries(alunoStats)
      .map(([id, s]) => ({ id, nome: (estMap[id] || {}).nome || '—', turma: (estMap[id] || {}).turma_nome || '', media: s.total > 0 ? s.soma / s.total : 0, regs: s.total }))
      .sort((a, b) => b.media - a.media);

    return `
      <!-- MÉTRICAS GLOBAIS -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
          <p class="text-[9px] font-bold uppercase text-gray-400">Total Registros</p>
          <p class="text-2xl font-black">${registros.length}</p>
        </div>
        <div class="bg-green-50 border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
          <p class="text-[9px] font-bold uppercase text-green-600">Presenças</p>
          <p class="text-2xl font-black text-green-700">${presentes.length}</p>
        </div>
        <div class="bg-blue-50 border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
          <p class="text-[9px] font-bold uppercase text-blue-600">Frequência</p>
          <p class="text-2xl font-black text-blue-700">${pctFreq}%</p>
        </div>
        <div class="bg-purple-50 border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
          <p class="text-[9px] font-bold uppercase text-purple-600">Alunos Atendidos</p>
          <p class="text-2xl font-black text-purple-700">${Object.keys(alunoStats).length}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- DISTRIBUIÇÃO DE COMPREENSÃO -->
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="pie-chart" class="w-4 h-4 text-purple-600"></i> Distribuição de Compreensão
          </h3>
          <div class="space-y-3">
            ${ESCALA_NOMES.map((nome, i) => {
              const count = dist[nome];
              const pct = presentes.length > 0 ? Math.round((count / presentes.length) * 100) : 0;
              return `<div>
                <div class="flex justify-between text-[10px] font-bold mb-1">
                  <span class="text-gray-600">${nome}</span>
                  <span>${count} (${pct}%)</span>
                </div>
                <div class="w-full bg-gray-200 h-3 border border-black">
                  <div class="bg-${ESCALA_CORES[i]}-500 h-full" style="width:${pct}%"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- RANKING -->
        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
            <i data-lucide="trophy" class="w-4 h-4 text-yellow-600"></i> Ranking por Média
          </h3>
          <div class="space-y-1.5 max-h-72 overflow-y-auto">
            ${ranking.slice(0, 20).map((r, i) => {
              const barW = Math.round((r.media / 4) * 100);
              const color = r.media >= 3 ? 'green' : r.media >= 2 ? 'blue' : 'red';
              return `<div class="flex items-center gap-2 p-1.5 border border-black bg-gray-50">
                <span class="text-[10px] font-black w-5 text-center text-gray-400">${i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-bold truncate">${r.nome}</p>
                  <div class="w-full bg-gray-200 h-1.5 mt-0.5"><div class="bg-${color}-500 h-full" style="width:${barW}%"></div></div>
                </div>
                <span class="text-[10px] font-black text-${color}-700">${r.media.toFixed(1)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }

  function renderGuide() {
    return `<div class="text-center py-12 text-gray-400">
      <i data-lucide="bar-chart-2" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
      <p class="text-xs font-bold uppercase tracking-wider">Clique "Analisar" para carregar os dados de evolução</p>
    </div>`;
  }
}
