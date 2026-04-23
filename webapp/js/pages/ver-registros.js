/**
 * 📋 RELATÓRIOS MENSAIS — Coordenação
 * Gera relatórios por professor:
 * 1) Estudantes atendidos no mês
 * 2) Faltas totais
 * 3) Consolidado mensal
 */

import {
  listarTodosRegistrosMes,
  listarConsolidadosMensais,
  listarProfsReforco,
  listarEstudantes
} from '../db.js';

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export async function renderVerRegistros(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  const now = new Date();
  let mesSel = now.getMonth() + 1;
  let anoSel = now.getFullYear();
  let profSel = '';

  let profs = [];
  const profMap = {};
  const estMap = {};

  container.innerHTML = loadingHTML();

  try {
    const [profsDb, estudantesDb] = await Promise.all([
      listarProfsReforco(),
      listarEstudantes(null, true)
    ]);
    profs = Array.isArray(profsDb) ? profsDb : [];
    profs.forEach((p) => { profMap[String(p.id)] = p; });
    (Array.isArray(estudantesDb) ? estudantesDb : []).forEach((e) => { estMap[String(e.id)] = e; });
  } catch (e) {
    console.error('Erro ao carregar base dos relatórios:', e);
  }

  await renderShell();

  async function renderShell() {
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Relatórios Mensais</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Quantidade de estudantes atendidos, faltas totais e consolidado mensal por professor.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Mês</label>
              <select id="filtro-mes" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${NOMES_MES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === mesSel ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Ano</label>
              <select id="filtro-ano" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                ${buildAnos(anoSel).map((a) => `<option value="${a}" ${a === anoSel ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Professor de Reforço</label>
              <select id="filtro-prof" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
                <option value="">Todos</option>
                ${profs.map((p) => `<option value="${escAttr(p.id)}" ${String(p.id) === String(profSel) ? 'selected' : ''}>${esc(p.nome)}${p.area ? ` (${esc(p.area)})` : ''}</option>`).join('')}
              </select>
            </div>
            <div class="md:self-end">
              <button id="btn-buscar-relatorios" class="w-full bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2">
                <i data-lucide="search" class="w-4 h-4"></i> Gerar Relatórios
              </button>
            </div>
          </div>
        </div>

        <div id="regs-result">
          <div class="text-center py-8">
            <div class="h-8 w-8 mx-auto skeleton rounded-full mb-2"></div>
            <p class="text-xs font-bold text-gray-400">Carregando relatórios...</p>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    container.querySelector('#btn-buscar-relatorios')?.addEventListener('click', async () => {
      mesSel = Number(container.querySelector('#filtro-mes')?.value || mesSel);
      anoSel = Number(container.querySelector('#filtro-ano')?.value || anoSel);
      profSel = String(container.querySelector('#filtro-prof')?.value || '');
      await fetchAndShow();
    });

    await fetchAndShow();
  }

  async function fetchAndShow() {
    const resultDiv = container.querySelector('#regs-result');
    if (!resultDiv) return;
    resultDiv.innerHTML = '<div class="text-center py-8"><div class="h-6 skeleton rounded w-48 mx-auto"></div></div>';

    try {
      const [regsMes, consolidadosAll] = await Promise.all([
        listarTodosRegistrosMes(mesSel, anoSel),
        listarConsolidadosMensais()
      ]);

      const registrosFiltrados = filtrarPorProfessor(regsMes || [], profSel);
      const consolidadosMes = filtrarConsolidadosMes(consolidadosAll || [], mesSel, anoSel);
      const consolidadosFiltrados = filtrarConsolidadosPorProfessor(consolidadosMes, profSel);

      if (!registrosFiltrados.length && !consolidadosFiltrados.length) {
        resultDiv.innerHTML = `
          <div class="text-center py-12 text-gray-400 bg-white border-2 border-black">
            <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
            <p class="text-xs font-bold uppercase tracking-wider">Sem dados para ${NOMES_MES[mesSel - 1]}/${anoSel}${profSel ? ' com o professor selecionado' : ''}.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      const analise = montarAnalise(registrosFiltrados, consolidadosFiltrados, profMap, estMap);

      resultDiv.innerHTML = `
        <div class="space-y-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${metricCard('Registros no Mês', analise.totalRegistros, 'file-text', 'gray')}
            ${metricCard('Estudantes Atendidos', analise.totalAlunosAtendidos, 'users', 'blue')}
            ${metricCard('Faltas Totais', analise.totalFaltas, 'x-circle', 'red')}
            ${metricCard('Consolidados no Mês', analise.totalConsolidados, 'clipboard-check', 'green')}
          </div>

          ${renderRelatorioAtendidos(analise.relatorioAtendidos)}
          ${renderRelatorioFaltas(analise.relatorioFaltas)}
          ${renderRelatorioConsolidado(analise.relatorioConsolidado)}
          ${renderLancamentosDiarios(registrosFiltrados)}
        </div>
      `;

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.error('Erro ao gerar relatórios mensais:', err);
      resultDiv.innerHTML = `<p class="text-xs font-bold text-red-600 text-center py-8">Erro ao gerar relatórios: ${esc(err.message || 'Falha desconhecida')}</p>`;
    }
  }
}

function montarAnalise(registros, consolidados, profMap, estMap) {
  const totalRegistros = registros.length;
  const presentes = registros.filter((r) => isPresent(r));
  const faltas = registros.filter((r) => !isPresent(r));
  const totalFaltas = faltas.length;

  const alunosAtendidosSet = new Set();
  presentes.forEach((r) => {
    const id = String(r?.estudante_id || '').trim();
    if (id) alunosAtendidosSet.add(id);
  });

  const relatorioAtendidos = construirRelatorioAtendidos(registros, profMap);
  const relatorioFaltas = construirRelatorioFaltas(faltas);
  const relatorioConsolidado = construirRelatorioConsolidado(consolidados, profMap, estMap);

  return {
    totalRegistros,
    totalAlunosAtendidos: alunosAtendidosSet.size,
    totalFaltas,
    totalConsolidados: consolidados.length,
    relatorioAtendidos,
    relatorioFaltas,
    relatorioConsolidado
  };
}

function construirRelatorioAtendidos(registros, profMap) {
  const stats = {};

  registros.forEach((r) => {
    const profId = String(r?.prof_id || 'sem-prof');
    if (!stats[profId]) {
      const prof = profMap[profId] || {};
      stats[profId] = {
        profId,
        professor: r?.prof_nome || prof.nome || 'Sem professor',
        area: prof.area || r?.prof_area || '',
        registros: 0,
        presencas: 0,
        faltas: 0,
        alunosMesSet: new Set(),
        alunosAtendidosSet: new Set()
      };
    }

    const row = stats[profId];
    row.registros += 1;

    const alunoId = String(r?.estudante_id || '').trim();
    if (alunoId) row.alunosMesSet.add(alunoId);

    if (isPresent(r)) {
      row.presencas += 1;
      if (alunoId) row.alunosAtendidosSet.add(alunoId);
    } else {
      row.faltas += 1;
    }
  });

  return Object.values(stats)
    .map((r) => ({
      ...r,
      alunosNoMes: r.alunosMesSet.size,
      alunosAtendidos: r.alunosAtendidosSet.size,
      freqPct: r.registros > 0 ? Math.round((r.presencas / r.registros) * 100) : 0
    }))
    .sort((a, b) => (b.alunosAtendidos - a.alunosAtendidos) || (b.registros - a.registros) || a.professor.localeCompare(b.professor));
}

function construirRelatorioFaltas(faltas) {
  const motivosMap = {};
  const alunosComFaltaSet = new Set();

  const detalhes = faltas
    .map((r) => {
      const motivo = motivoFalta(r);
      motivosMap[motivo] = (motivosMap[motivo] || 0) + 1;
      const alunoId = String(r?.estudante_id || '');
      if (alunoId) alunosComFaltaSet.add(alunoId);

      return {
        data: r?.data_registro || '',
        aluno: r?.estudante_nome || 'Sem nome',
        turma: r?.turma_nome || 'Sem turma',
        professor: r?.prof_nome || 'Sem professor',
        motivo
      };
    })
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.aluno || '').localeCompare(b.aluno || ''));

  const motivos = Object.entries(motivosMap)
    .map(([motivo, qtd]) => ({
      motivo,
      qtd,
      pct: faltas.length > 0 ? Math.round((qtd / faltas.length) * 100) : 0
    }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    totalFaltas: faltas.length,
    totalAlunosComFalta: alunosComFaltaSet.size,
    motivos,
    detalhes
  };
}

function construirRelatorioConsolidado(consolidados, profMap, estMap) {
  const porProfessorMap = {};
  const detalhes = [];

  let comParecer = 0;
  let comAcao = 0;
  let comAlta = 0;
  let comStatusFinal = 0;

  consolidados.forEach((c) => {
    const profId = String(c?.prof_id || 'sem-prof');
    if (!porProfessorMap[profId]) {
      const p = profMap[profId] || {};
      porProfessorMap[profId] = {
        profId,
        professor: p.nome || txt(c?.prof_nome) || 'Sem professor',
        total: 0,
        comParecer: 0,
        comAcao: 0,
        comAlta: 0,
        comStatusFinal: 0
      };
    }

    const row = porProfessorMap[profId];
    row.total += 1;

    const parecer = txt(c?.parecer_evolutivo);
    const acao = txt(c?.acao_pedagogica);
    const statusFinal = txt(c?.status_final_consolidado);
    const alta = isAlta(c?.recomendacao_alta);

    if (parecer) {
      row.comParecer += 1;
      comParecer += 1;
    }
    if (acao) {
      row.comAcao += 1;
      comAcao += 1;
    }
    if (statusFinal) {
      row.comStatusFinal += 1;
      comStatusFinal += 1;
    }
    if (alta) {
      row.comAlta += 1;
      comAlta += 1;
    }

    const alunoId = String(c?.estudante_id || '');
    const aluno = estMap[alunoId] || {};

    detalhes.push({
      data: c?.data_registro || '',
      aluno: aluno.nome || txt(c?.estudante_nome) || 'Sem nome',
      turma: aluno.turma_nome || txt(c?.turma_nome) || 'Sem turma',
      professor: row.professor,
      parecer: parecer || 'Não informado',
      acao: acao || 'Não informada',
      statusFinal: statusFinal || 'Não informado',
      alta: alta ? 'Sim' : 'Não'
    });
  });

  const porProfessor = Object.values(porProfessorMap)
    .map((r) => ({
      ...r,
      pctParecer: r.total > 0 ? Math.round((r.comParecer / r.total) * 100) : 0,
      pctAcao: r.total > 0 ? Math.round((r.comAcao / r.total) * 100) : 0,
      pctStatusFinal: r.total > 0 ? Math.round((r.comStatusFinal / r.total) * 100) : 0
    }))
    .sort((a, b) => (b.total - a.total) || a.professor.localeCompare(b.professor));

  const pendencias = detalhes.filter((d) => d.parecer === 'Não informado' || d.acao === 'Não informada' || d.statusFinal === 'Não informado');

  return {
    total: consolidados.length,
    comParecer,
    comAcao,
    comAlta,
    comStatusFinal,
    porProfessor,
    pendencias,
    detalhes: detalhes.sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  };
}

function renderRelatorioAtendidos(rows) {
  return `
    <section class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
        <i data-lucide="users" class="w-4 h-4 text-blue-600"></i> Relatório de Estudantes Atendidos no Mês
      </h3>
      ${rows.length === 0 ? `<p class="text-xs font-bold text-gray-400">Sem registros para calcular atendimento por professor.</p>` : `
        <div class="overflow-x-auto">
          <table class="min-w-full border border-black text-[10px]">
            <thead class="bg-black text-white">
              <tr>
                <th class="p-2 text-left">Professor</th>
                <th class="p-2 text-center">Estudantes Atendidos</th>
                <th class="p-2 text-center">Estudantes no Mês</th>
                <th class="p-2 text-center">Lançamentos</th>
                <th class="p-2 text-center">Faltas</th>
                <th class="p-2 text-center">Frequência</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r) => `
                <tr class="border-t border-black bg-white">
                  <td class="p-2">
                    <p class="font-black">${esc(r.professor)}</p>
                    <p class="text-[9px] font-bold text-gray-500">${esc(r.area || 'Área não informada')}</p>
                  </td>
                  <td class="p-2 text-center font-black">${r.alunosAtendidos}</td>
                  <td class="p-2 text-center font-black">${r.alunosNoMes}</td>
                  <td class="p-2 text-center font-black">${r.registros}</td>
                  <td class="p-2 text-center font-black text-red-700">${r.faltas}</td>
                  <td class="p-2 text-center font-black">${r.freqPct}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;
}

function renderRelatorioFaltas(relatorio) {
  return `
    <section class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
        <i data-lucide="shield-alert" class="w-4 h-4 text-red-600"></i> Relatório de Faltas Totais
      </h3>

      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        ${miniMetric('Faltas no Mês', relatorio.totalFaltas, 'x-circle', 'red')}
        ${miniMetric('Alunos Que Faltaram', relatorio.totalAlunosComFalta, 'user-x', 'amber')}
        ${miniMetric('Motivos Diferentes', relatorio.motivos.length, 'list-filter', 'gray')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Faltas por Motivo</p>
          ${relatorio.motivos.length === 0 ? `<p class="text-xs font-bold text-gray-400">Sem faltas no período.</p>` : `
            <div class="space-y-2">
              ${relatorio.motivos.map((m) => `
                <div>
                  <div class="flex justify-between text-[10px] font-bold mb-1">
                    <span>${esc(m.motivo)}</span>
                    <span>${m.qtd} (${m.pct}%)</span>
                  </div>
                  <div class="w-full h-2.5 border border-black bg-gray-100">
                    <div class="h-full bg-red-500" style="width:${m.pct}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Detalhamento de Faltas</p>
          ${renderTabelaFaltas(relatorio.detalhes)}
        </div>
      </div>
    </section>
  `;
}

function renderTabelaFaltas(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem faltas registradas.</p>`;
  }
  return `
    <div class="space-y-2 max-h-80 overflow-y-auto">
      ${rows.slice(0, 80).map((r) => `
        <div class="border border-black bg-gray-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black border border-black px-1.5 py-0.5 bg-red-100 text-red-900">${formatDate(r.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.professor)}</p>
          <p class="text-[10px] font-bold text-gray-700 mt-1">Motivo: ${esc(r.motivo)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRelatorioConsolidado(relatorio) {
  return `
    <section class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
        <i data-lucide="clipboard-check" class="w-4 h-4 text-green-600"></i> Relatório do Consolidado Mensal
      </h3>

      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        ${miniMetric('Total de Consolidados', relatorio.total, 'files', 'gray')}
        ${miniMetric('Com Parecer', relatorio.comParecer, 'message-square', 'blue')}
        ${miniMetric('Com Ação Pedagógica', relatorio.comAcao, 'list-checks', 'emerald')}
        ${miniMetric('Com Status Final', relatorio.comStatusFinal, 'check-check', 'cyan')}
        ${miniMetric('Alta Recomendada', relatorio.comAlta, 'graduation-cap', 'amber')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Consolidado por Professor</p>
          ${renderTabelaConsolidadoProfessor(relatorio.porProfessor)}
        </div>
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Pendências de Preenchimento</p>
          ${renderPendenciasConsolidado(relatorio.pendencias)}
        </div>
      </div>

      <div class="mt-5">
        <p class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Detalhes do Consolidado</p>
        ${renderDetalhesConsolidado(relatorio.detalhes)}
      </div>
    </section>
  `;
}

function renderTabelaConsolidadoProfessor(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem consolidado mensal no recorte.</p>`;
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full border border-black text-[10px]">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-2 text-left">Professor</th>
            <th class="p-2 text-center">Total</th>
            <th class="p-2 text-center">Parecer</th>
            <th class="p-2 text-center">Ação</th>
            <th class="p-2 text-center">Status Final</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr class="border-t border-black bg-white">
              <td class="p-2 font-black">${esc(r.professor)}</td>
              <td class="p-2 text-center font-black">${r.total}</td>
              <td class="p-2 text-center font-black">${r.comParecer} (${r.pctParecer}%)</td>
              <td class="p-2 text-center font-black">${r.comAcao} (${r.pctAcao}%)</td>
              <td class="p-2 text-center font-black">${r.comStatusFinal} (${r.pctStatusFinal}%)</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPendenciasConsolidado(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-green-700">Nenhuma pendência de preenchimento no consolidado.</p>`;
  }

  return `
    <div class="space-y-2 max-h-72 overflow-y-auto">
      ${rows.slice(0, 40).map((r) => `
        <div class="border border-black bg-amber-50 p-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black truncate">${esc(r.aluno)}</p>
            <span class="text-[10px] font-black">${formatDate(r.data)}</span>
          </div>
          <p class="text-[10px] font-bold text-gray-600">${esc(r.turma)} • ${esc(r.professor)}</p>
          <p class="text-[10px] font-bold mt-1 text-amber-800">
            ${r.parecer === 'Não informado' ? 'Sem parecer' : ''}${r.parecer === 'Não informado' && (r.acao === 'Não informada' || r.statusFinal === 'Não informado') ? ' • ' : ''}
            ${r.acao === 'Não informada' ? 'Sem ação pedagógica' : ''}${r.acao === 'Não informada' && r.statusFinal === 'Não informado' ? ' • ' : ''}
            ${r.statusFinal === 'Não informado' ? 'Sem status final' : ''}
          </p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetalhesConsolidado(rows) {
  if (rows.length === 0) {
    return `<p class="text-xs font-bold text-gray-400">Sem detalhes de consolidado para o período.</p>`;
  }

  return `
    <div class="overflow-x-auto max-h-96">
      <table class="min-w-full border border-black text-[10px]">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-2 text-left">Data</th>
            <th class="p-2 text-left">Aluno</th>
            <th class="p-2 text-left">Turma</th>
            <th class="p-2 text-left">Professor</th>
            <th class="p-2 text-left">Parecer</th>
            <th class="p-2 text-center">Alta</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 120).map((r) => `
            <tr class="border-t border-black bg-white">
              <td class="p-2 font-bold">${formatDate(r.data)}</td>
              <td class="p-2 font-black">${esc(r.aluno)}</td>
              <td class="p-2">${esc(r.turma)}</td>
              <td class="p-2">${esc(r.professor)}</td>
              <td class="p-2">${esc(r.parecer)}</td>
              <td class="p-2 text-center font-black">${r.alta}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLancamentosDiarios(regs) {
  if (regs.length === 0) {
    return `
      <section class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="table" class="w-4 h-4 text-gray-600"></i> Lançamentos Diários do Mês
        </h3>
        <p class="text-xs font-bold text-gray-400">Sem lançamentos diários para exibir.</p>
      </section>
    `;
  }

  const byDate = {};
  regs.forEach((r) => {
    const data = r?.data_registro || 'Sem data';
    if (!byDate[data]) byDate[data] = [];
    byDate[data].push(r);
  });

  return `
    <section class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
        <i data-lucide="table" class="w-4 h-4 text-gray-600"></i> Lançamentos Diários do Mês
      </h3>
      <div class="space-y-4">
        ${Object.entries(byDate)
          .sort((a, b) => (b[0] || '').localeCompare(a[0] || ''))
          .map(([data, itens]) => `
            <div class="border-2 border-black">
              <div class="bg-black text-white px-3 py-2 flex items-center justify-between">
                <p class="text-xs font-black uppercase tracking-wider">${formatDate(data)}</p>
                <span class="text-[10px] font-bold text-gray-300">${itens.length} lançamento(s)</span>
              </div>
              <div class="divide-y divide-gray-200">
                ${itens.map((r) => `
                  <div class="px-3 py-2 flex items-center gap-2 text-[11px]">
                    <span class="font-black w-[30%] truncate">${esc(r.estudante_nome || '—')}</span>
                    <span class="font-bold text-gray-500 w-[20%] truncate">${esc(r.turma_nome || '—')}</span>
                    <span class="w-[18%]">
                      <span class="px-1.5 py-0.5 text-[9px] font-bold uppercase border border-black ${isPresent(r) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${isPresent(r) ? 'Presente' : 'Falta'}
                      </span>
                    </span>
                    <span class="font-bold text-gray-500 flex-1 truncate text-right">${esc(r.prof_nome || 'Sem professor')}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
      </div>
    </section>
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

function miniMetric(label, valor, icon, color) {
  return `
    <div class="border-2 border-black bg-gray-50 p-3 text-center">
      <div class="flex items-center justify-center gap-1 mb-1">
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
        <p class="text-[9px] font-bold uppercase tracking-wider text-gray-500">${label}</p>
      </div>
      <p class="text-xl font-black">${valor}</p>
    </div>
  `;
}

function filtrarPorProfessor(regs, profId) {
  if (!profId) return regs;
  return regs.filter((r) => String(r?.prof_id || '') === String(profId));
}

function filtrarConsolidadosMes(rows, mes, ano) {
  const prefix = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
  return rows.filter((r) => String(r?.data_registro || '').startsWith(prefix));
}

function filtrarConsolidadosPorProfessor(rows, profId) {
  if (!profId) return rows;
  return rows.filter((r) => String(r?.prof_id || '') === String(profId));
}

function buildAnos(anoRef) {
  const base = Number(anoRef) || new Date().getFullYear();
  return [base - 2, base - 1, base, base + 1];
}

function loadingHTML() {
  return `
    <div class="animate-fade-in">
      <div class="border-b-4 border-black pb-4 mb-6">
        <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Relatórios Mensais</h2>
        <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
      </div>
      <div class="h-40 skeleton rounded"></div>
    </div>
  `;
}

function isPresent(r) {
  return r?.compareceu === 1 || r?.compareceu === true || r?.presente === 1 || r?.presente === true;
}

function motivoFalta(r) {
  return txt(r?.motivo_falta) || 'Sem motivo informado';
}

function isAlta(v) {
  return v === true || v === 1 || String(v).toLowerCase() === 'true';
}

function txt(v) {
  const out = String(v || '').trim();
  return out || '';
}

function formatDate(iso) {
  const raw = String(iso || '');
  if (!raw || !raw.includes('-')) return raw || 'Sem data';
  const [yyyy, mm, dd] = raw.split('-');
  if (!yyyy || !mm || !dd) return raw;
  return `${dd}/${mm}/${yyyy}`;
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
