/**
 * 📈 RELATÓRIO DE EVOLUÇÃO — Visão Regente
 * Acompanhe graficamente o progresso dos seus alunos no Reforço Escolar.
 */

import {
  listarTurmas, listarRegistrosPorRegente, listarConsolidadosPorRegente,
  compreensaoParaNota, ESCALA_COMPREENSAO
} from '../db.js';

export async function renderRelatorioEvolucao(container, session) {
  if (session.perfil !== 'regente') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito a Regentes.</p>`;
    return;
  }

  let bimestreFiltro = "Todos";
  let turmaSelecionadaId = "";

  container.innerHTML = loadingHTML();

  const allTurmas = await listarTurmas();
  const turmasDoRegente = allTurmas.filter(t => (session.turmasIds || []).includes(String(t.id)));

  if (turmasDoRegente.length === 0) {
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📈 Relatório de Evolução</h2>
        </div>
        <div class="bg-yellow-50 border-2 border-black p-5">
          <p class="font-bold text-yellow-800">⚠️ Você não está lotado(a) em nenhuma turma atualmente.</p>
        </div>
      </div>`;
    return;
  }

  turmaSelecionadaId = turmasDoRegente[0].id;
  await renderPage();

  async function renderPage() {
    const dados = await listarRegistrosPorRegente(session.profId, bimestreFiltro);
    const dadosTurma = dados.filter(d => d.turma_id === turmaSelecionadaId);

    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📈 Relatório de Evolução</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Acompanhe graficamente o progresso dos seus alunos no Reforço Escolar.</p>
        </div>

        <!-- FILTROS -->
        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Selecione a Turma</label>
            <select id="evo-turma" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${turmasDoRegente.map(t => `<option value="${t.id}" ${t.id === turmaSelecionadaId ? 'selected' : ''}>${t.nome} (${t.etapa_nome || ''})</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bimestre</label>
            <select id="evo-bim" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${["Todos", "I", "II", "III", "IV"].map(b => `<option value="${b}" ${b === bimestreFiltro ? 'selected' : ''}>${b === "Todos" ? "Todos os Bimestres" : "Bimestre " + b}</option>`).join('')}
            </select>
          </div>
        </div>
    `;

    if (!dadosTurma.length) {
      html += `<div class="bg-blue-50 border-2 border-black p-4 text-center"><p class="font-bold text-blue-800">Nenhum dado de reforço encontrado para esta turma e bimestre selecionados.</p></div></div>`;
      container.innerHTML = html;
      attachEvents();
      if (window.lucide) lucide.createIcons();
      return;
    }

    // COMPUTE METRICS
    const totalRegistros = dadosTurma.length;
    const presentes = dadosTurma.filter(d => d.compareceu === 1);
    const totalPresentes = presentes.length;
    const totalFaltas = totalRegistros - totalPresentes;
    const taxaPresenca = totalRegistros > 0 ? Math.round(totalPresentes / totalRegistros * 100) : 0;
    const alunosUnicos = [...new Set(dadosTurma.map(d => d.estudante_id))].length;

    let mediaComp = 0;
    let taxaAutonomia = 0;
    const notasPresentes = presentes.map(d => compreensaoParaNota(d.nivel_compreensao || 0)).filter(n => n > 0);
    if (notasPresentes.length > 0) {
      mediaComp = (notasPresentes.reduce((a, b) => a + b, 0) / notasPresentes.length).toFixed(1);
      taxaAutonomia = Math.round(notasPresentes.filter(n => n === 4).length / notasPresentes.length * 100);
    }

    // MÉTRICAS GERAIS
    html += `
      <div class="bg-white border-2 border-black p-5 mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">📊 Visão Geral da Turma no Reforço</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${metricCard('Alunos Atendidos', alunosUnicos, 'users', 'purple')}
          ${metricCard('Taxa de Presença', taxaPresenca + '%', 'check-circle', 'green')}
          ${metricCard('Média Compreensão', mediaComp + '/4', 'brain', 'blue')}
          ${metricCard('Autonomia Total', taxaAutonomia + '%', 'award', 'orange')}
        </div>
      </div>
    `;

    // GRÁFICO 1: EVOLUÇÃO TEMPORAL
    if (notasPresentes.length > 0) {
      // Group by date
      const byDate = {};
      presentes.forEach(d => {
        const dt = d.data_registro;
        if (!byDate[dt]) byDate[dt] = [];
        const nota = compreensaoParaNota(d.nivel_compreensao || 0);
        if (nota > 0) byDate[dt].push(nota);
      });

      const dateEntries = Object.entries(byDate).filter(([, arr]) => arr.length > 0).sort((a, b) => a[0].localeCompare(b[0]));

      if (dateEntries.length > 1) {
        const maxV = Math.max(...dateEntries.map(([, arr]) => arr.reduce((a, b) => a + b, 0) / arr.length));

        html += `
          <div class="bg-white border-2 border-black p-5 mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">📈 Evolução da Compreensão ao Longo do Tempo</h3>
            <div class="relative h-48 md:h-64 flex items-end gap-1">
        `;

        // Simple bar chart
        for (const [dateStr, arr] of dateEntries) {
          const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
          const pct = Math.round((avg / 4) * 100);
          const dp = dateStr.split('-');
          const label = dp.length === 3 ? `${dp[2]}/${dp[1]}` : dateStr;
          const colors = ['bg-red-500', 'bg-orange-500', 'bg-blue-500', 'bg-green-500'];
          const colorIdx = Math.min(3, Math.max(0, Math.round(avg) - 1));

          html += `
            <div class="flex-1 flex flex-col items-center justify-end h-full min-w-0">
              <p class="text-[8px] font-black mb-1">${avg.toFixed(1)}</p>
              <div class="w-full ${colors[colorIdx]} border border-black transition-all" style="height:${pct}%"></div>
              <p class="text-[7px] font-bold mt-1 text-gray-400 truncate w-full text-center">${label}</p>
            </div>`;
        }

        html += `
            </div>
            <div class="flex justify-between text-[8px] text-gray-400 uppercase font-bold mt-2 border-t border-gray-200 pt-1">
              <span>1 = Não comp.</span><span>2 = Muita int.</span><span>3 = Pouca int.</span><span class="text-green-600">4 = Autônomo ✓</span>
            </div>
          </div>
        `;
      }
    }

    // GRÁFICO 2: FREQUÊNCIA POR ALUNO
    const alunoFreq = {};
    dadosTurma.forEach(d => {
      if (!alunoFreq[d.estudante_nome]) alunoFreq[d.estudante_nome] = { p: 0, f: 0 };
      if (d.compareceu === 1) alunoFreq[d.estudante_nome].p++;
      else alunoFreq[d.estudante_nome].f++;
    });

    const freqArr = Object.entries(alunoFreq).map(([nome, { p, f }]) => ({
      nome, p, f, total: p + f, taxa: p + f > 0 ? Math.round(p / (p + f) * 100) : 0
    })).sort((a, b) => a.taxa - b.taxa);

    html += `
      <div class="bg-white border-2 border-black p-5 mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">📅 Comparativo de Frequência por Aluno</h3>
        <div class="space-y-2">
          ${freqArr.map(a => `
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-gray-600 w-28 md:w-40 truncate flex-shrink-0">${a.nome}</span>
              <div class="flex-1 flex h-5 border border-black overflow-hidden">
                <div class="bg-green-500 h-full flex items-center justify-center" style="width:${a.taxa}%">
                  ${a.p > 0 ? `<span class="text-white text-[8px] font-black">${a.p}</span>` : ''}
                </div>
                <div class="bg-red-400 h-full flex items-center justify-center" style="width:${100 - a.taxa}%">
                  ${a.f > 0 ? `<span class="text-white text-[8px] font-black">${a.f}</span>` : ''}
                </div>
              </div>
              <span class="text-[10px] font-black w-10 text-right">${a.taxa}%</span>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-4 mt-3 text-[9px] font-bold text-gray-400 uppercase">
          <span class="flex items-center gap-1"><span class="w-3 h-3 bg-green-500 border border-black inline-block"></span> Presenças</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 bg-red-400 border border-black inline-block"></span> Faltas</span>
        </div>
      </div>
    `;

    // GRÁFICO 3: RANKING DE COMPREENSÃO
    if (notasPresentes.length > 0) {
      const alunoComp = {};
      presentes.forEach(d => {
        const nota = compreensaoParaNota(d.nivel_compreensao || 0);
        if (nota > 0) {
          if (!alunoComp[d.estudante_nome]) alunoComp[d.estudante_nome] = [];
          alunoComp[d.estudante_nome].push(nota);
        }
      });

      const rankArr = Object.entries(alunoComp).map(([nome, notas]) => ({
        nome,
        media: notas.reduce((a, b) => a + b, 0) / notas.length,
        qtd: notas.length
      })).sort((a, b) => b.media - a.media);

      html += `
        <div class="bg-white border-2 border-black p-5 mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">🏆 Ranking de Compreensão por Aluno</h3>
          <div class="space-y-2">
            ${rankArr.map((a, i) => {
              const pct = Math.round((a.media / 4) * 100);
              const colors = ['bg-red-500', 'bg-orange-500', 'bg-blue-500', 'bg-green-500'];
              const colorIdx = Math.min(3, Math.max(0, Math.round(a.media) - 1));
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`;
              return `
                <div class="flex items-center gap-2">
                  <span class="text-sm font-black w-8 text-center">${medal}</span>
                  <span class="text-[10px] font-black uppercase tracking-wider text-gray-600 w-28 md:w-40 truncate flex-shrink-0">${a.nome}</span>
                  <div class="flex-1 h-5 bg-gray-200 border border-black overflow-hidden">
                    <div class="${colors[colorIdx]} h-full flex items-center justify-center" style="width:${pct}%">
                      <span class="text-white text-[8px] font-black">${a.media.toFixed(1)}</span>
                    </div>
                  </div>
                  <span class="text-[9px] text-gray-400 font-bold w-14 text-right">(${a.qtd} aulas)</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelector('#evo-turma')?.addEventListener('change', (e) => {
      turmaSelecionadaId = e.target.value;
      renderPage();
    });
    container.querySelector('#evo-bim')?.addEventListener('change', (e) => {
      bimestreFiltro = e.target.value;
      renderPage();
    });
  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📈 Relatório de Evolução</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}

function metricCard(label, value, icon, color) {
  return `<div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
    <div class="flex items-center gap-1.5 mb-1">
      <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400">${label}</span>
    </div>
    <p class="text-xl font-black">${value}</p>
  </div>`;
}
