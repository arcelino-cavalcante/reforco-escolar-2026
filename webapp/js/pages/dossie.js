/**
 * 🧑‍🎓 DOSSIÊ DO ESTUDANTE — Coordenação
 * Prontuário completo com filtros por turma e período
 */

import {
  listarTurmas,
  listarEstudantes,
  listarProfsReforco,
  listarRegistrosPorEstudante,
  compreensaoParaNota
} from '../db.js';

export async function renderDossie(container, session) {
  let turmas = [], estudantes = [], profsR = [];
  let selTurma = '', selEstudante = '';
  let registros = [];

  container.innerHTML = loadingHTML();

  try {
    [turmas, estudantes, profsR] = await Promise.all([
      listarTurmas(), listarEstudantes(), listarProfsReforco()
    ]);
  } catch (e) { console.error(e); }

  renderPage();

  function renderPage() {
    const alunosFiltrados = selTurma ? estudantes.filter(e => e.turma_id === selTurma) : estudantes;
    const aluno = selEstudante ? estudantes.find(e => e.id === selEstudante) : null;

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Dossiê do Estudante</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Prontuário completo e analítico</p>
        </div>

        <!-- FILTROS -->
        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="dossie-turma" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todas as Turmas</option>
                ${turmas.map(t => `<option value="${t.id}" ${selTurma === t.id ? 'selected' : ''}>${t.nome} (${t.etapa_nome})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Estudante</label>
              <select id="dossie-aluno" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Selecione o aluno...</option>
                ${alunosFiltrados.map(e => `<option value="${e.id}" ${selEstudante === e.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-end">
              <button id="btn-buscar-dossie" class="w-full bg-black border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2">
                <i data-lucide="search" class="w-4 h-4"></i> Buscar Dossiê
              </button>
            </div>
          </div>
        </div>

        <div id="dossie-content">
          ${aluno && registros.length > 0 ? renderDossieContent(aluno) : (selEstudante && registros.length === 0 && aluno ? renderNoData(aluno) : renderEmptyGuide())}
        </div>
      </div>`;

    if (window.lucide) lucide.createIcons();
    attachEv();
  }

  function attachEv() {
    container.querySelector('#dossie-turma')?.addEventListener('change', (e) => {
      selTurma = e.target.value;
      selEstudante = '';
      registros = [];
      renderPage();
    });
    container.querySelector('#dossie-aluno')?.addEventListener('change', (e) => {
      selEstudante = e.target.value;
    });
    container.querySelector('#btn-buscar-dossie')?.addEventListener('click', async () => {
      if (!selEstudante) return;
      await buscarRegistros();
      renderPage();
    });
  }

  async function buscarRegistros() {
    try {
      registros = await listarRegistrosPorEstudante(selEstudante);
    } catch (e) {
      console.error('Erro dossiê:', e);
      registros = [];
    }
  }

  function renderDossieContent(aluno) {
    const isPresent = (r) => r.compareceu === 1 || r.compareceu === true || r.presente === 1 || r.presente === true;
    const presentes = registros.filter((r) => isPresent(r));
    const faltas = registros.filter((r) => !isPresent(r));
    const pctFreq = registros.length > 0 ? Math.round((presentes.length / registros.length) * 100) : 0;

    // Compreensão média
    const notas = presentes.map((r) => compreensaoParaNota(r.nivel_compreensao || 0)).filter((n) => n > 0);
    const mediaComp = notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '—';

    const profMap = {};
    profsR.forEach(p => { profMap[p.id] = p; });

    return `
      <!-- PANORAMA -->
      <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-6">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="user" class="w-5 h-5 text-teal-600"></i> ${aluno.nome}
        </h3>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">${aluno.turma_nome || ''} · ${aluno.etapa_nome || ''}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="border-2 border-black p-3 text-center">
            <p class="text-[9px] font-bold uppercase text-gray-400">Total Registros</p>
            <p class="text-2xl font-black">${registros.length}</p>
          </div>
          <div class="border-2 border-black p-3 text-center bg-green-50">
            <p class="text-[9px] font-bold uppercase text-green-600">Presenças</p>
            <p class="text-2xl font-black text-green-700">${presentes.length}</p>
          </div>
          <div class="border-2 border-black p-3 text-center bg-red-50">
            <p class="text-[9px] font-bold uppercase text-red-600">Faltas</p>
            <p class="text-2xl font-black text-red-700">${faltas.length}</p>
          </div>
          <div class="border-2 border-black p-3 text-center bg-blue-50">
            <p class="text-[9px] font-bold uppercase text-blue-600">Frequência</p>
            <p class="text-2xl font-black text-blue-700">${pctFreq}%</p>
          </div>
        </div>
      </div>

      <!-- TIMELINE -->
      <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-orange-600"></i> Timeline de Lançamentos
        </h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          ${registros.map(r => {
            const prof = profMap[r.prof_id] || {};
            const presente = isPresent(r);
            const cor = presente ? 'green' : 'red';
            return `<div class="flex items-start gap-3 p-2 border-2 border-black bg-${cor}-50">
              <div class="flex-shrink-0 w-6 h-6 border-2 border-black bg-${cor}-200 flex items-center justify-center">
                <i data-lucide="${presente ? 'check' : 'x'}" class="w-3 h-3 text-${cor}-800"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black">${formatDate(r.data_registro)}</span>
                  <span class="text-[9px] font-bold text-gray-400">${prof.nome || ''}</span>
                </div>
                ${presente ? `
                  <p class="text-[10px] font-bold text-gray-600 mt-0.5">${r.habilidade_trabalhada || r.habilidades_trabalhadas || ''}</p>
                  <p class="text-[10px] font-bold mt-0.5">
                    <span class="px-1 py-0.5 border border-black bg-white text-[9px] uppercase">${r.nivel_compreensao || ''}</span>
                  </p>
                  ${(r.observacao || r.observacoes) ? `<p class="text-[10px] text-gray-500 mt-1 italic">"${r.observacao || r.observacoes}"</p>` : ''}
                ` : `<p class="text-[10px] font-bold text-red-600">Falta registrada${r.motivo_falta ? `: ${r.motivo_falta}` : ''}</p>`}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderNoData(aluno) {
    return `<div class="text-center py-12 text-gray-400">
      <i data-lucide="file-search" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
      <p class="text-xs font-bold uppercase tracking-wider">Nenhum registro encontrado para ${aluno.nome}</p>
    </div>`;
  }

  function renderEmptyGuide() {
    return `<div class="text-center py-12 text-gray-400">
      <i data-lucide="user-search" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
      <p class="text-xs font-bold uppercase tracking-wider">Selecione um estudante para ver o dossiê</p>
    </div>`;
  }
}

function loadingHTML() {
  return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Dossiê do Estudante</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
