/**
 * 👩‍🏫 PAINEL DA TURMA — Visão Regente
 * Acompanhe todo o trajeto dos seus alunos no Reforço em tempo real.
 */

import {
  listarTurmas, listarRegistrosPorRegente, listarConsolidadosPorRegente,
  listarEncaminhamentosEnviadosEstudante, marcarEncaminhamentoLidoRegente,
  criarEncaminhamento, compreensaoParaNota, ESCALA_COMPREENSAO
} from '../db.js';

export async function renderPainelRegente(container, session) {
  if (session.perfil !== 'regente') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito a Regentes.</p>`;
    return;
  }

  let bimestreFiltro = "Todos";
  let turmaTabAtiva = 0;
  let expandedStudents = {};

  container.innerHTML = loadingHTML();

  // Load data
  const allTurmas = await listarTurmas();
  const turmasDoRegente = allTurmas.filter(t => (session.turmasIds || []).includes(String(t.id)));

  if (turmasDoRegente.length === 0) {
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">👩‍🏫 Painel da Turma</h2>
        </div>
        <div class="bg-yellow-50 border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p class="font-bold text-yellow-800">⚠️ Você não está lotado(a) como professor titular em nenhuma turma atualmente. Fale com a Coordenação.</p>
        </div>
      </div>`;
    return;
  }

  await renderPage();

  async function renderPage() {
    const dados = await listarRegistrosPorRegente(session.profId, bimestreFiltro);
    const consolidados = await listarConsolidadosPorRegente(session.profId, bimestreFiltro);

    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">👩‍🏫 Painel da Turma</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Acompanhe todo o trajeto dos seus alunos no Reforço em tempo real.</p>
        </div>

        <!-- FILTRO BIMESTRE -->
        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Consultar Bimestre</label>
          <select id="reg-bim-filtro" class="w-full md:w-1/3 border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
            ${["Todos", "I", "II", "III", "IV"].map(b => `<option value="${b}" ${b === bimestreFiltro ? 'selected' : ''}>${b === "Todos" ? "Todos os Bimestres" : "Bimestre " + b}</option>`).join('')}
          </select>
        </div>
    `;

    if (!dados.length && !consolidados.length) {
      html += `<div class="bg-blue-50 border-2 border-black p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p class="font-bold text-blue-800">Nenhum lançamento constado pela equipe do Reforço Escolar para suas turmas${bimestreFiltro !== "Todos" ? " no Bimestre " + bimestreFiltro : ""}.</p>
      </div></div>`;
      container.innerHTML = html;
      attachEvents();
      if (window.lucide) lucide.createIcons();
      return;
    }

    // TURMA TABS
    html += `<div class="flex gap-2 mb-6 overflow-x-auto pb-2">`;
    turmasDoRegente.forEach((t, i) => {
      const isActive = i === turmaTabAtiva;
      html += `<button class="turma-tab flex-none px-4 py-2 border-2 border-black font-black uppercase tracking-wider text-xs whitespace-nowrap transition-colors ${isActive ? 'bg-purple-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}" data-idx="${i}">
        ${t.nome} (${t.etapa_nome || ''})
      </button>`;
    });
    html += `</div>`;

    // Content for active turma
    const activeTurma = turmasDoRegente[turmaTabAtiva];
    const dadosTurma = dados.filter(d => d.turma_id === activeTurma.id);
    const idsTurma = [...new Set(dadosTurma.map(d => d.estudante_id))];
    const consolidadosTurma = consolidados.filter(c => idsTurma.includes(c.estudante_id));

    if (!dadosTurma.length) {
      html += `<div class="bg-gray-50 border-2 border-black p-4 text-center"><p class="font-bold text-gray-500 italic">(Nenhum dado lançado para esta turma)</p></div>`;
    } else {
      // PANORAMA
      const presentes = dadosTurma.filter(d => d.compareceu === 1);
      const compCounts = {};
      presentes.forEach(d => {
        const nc = d.nivel_compreensao || 'Não Avaliado';
        compCounts[nc] = (compCounts[nc] || 0) + 1;
      });

      html += `
        <div class="bg-white border-2 border-black p-5 mb-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">📈 Panorama de Evolução da Turma</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            ${mc('Registros', dadosTurma.length, 'file-text', 'blue')}
            ${mc('Presenças', presentes.length, 'check-circle', 'green')}
            ${mc('Faltas', dadosTurma.length - presentes.length, 'x-circle', 'red')}
            ${mc('Alunos', idsTurma.length, 'users', 'purple')}
          </div>
          ${Object.keys(compCounts).length > 0 ? `
            <h4 class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Níveis de Compreensão (Aulas da Turma)</h4>
            <div class="space-y-2">
              ${Object.entries(compCounts).map(([nivel, qtd]) => {
                const pct = presentes.length > 0 ? Math.round(qtd / presentes.length * 100) : 0;
                const colors = {
                  "Não compreendeu a habilidade": "bg-red-500",
                  "Compreendeu com muita intervenção": "bg-orange-500",
                  "Compreendeu com pouca intervenção": "bg-blue-500",
                  "Autônomo (Domínio total)": "bg-green-500"
                };
                return `<div>
                  <div class="flex justify-between text-[10px] font-bold mb-0.5">
                    <span class="uppercase tracking-wider text-gray-600 truncate">${nivel}</span>
                    <span>${qtd} (${pct}%)</span>
                  </div>
                  <div class="w-full bg-gray-200 h-3 border border-black">
                    <div class="${colors[nivel] || 'bg-gray-500'} h-full" style="width:${pct}%"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;

      // DETALHES INDIVIDUAIS
      html += `<h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">🧑‍🎓 Detalhes Individuais por Estudante</h3>`;
      html += `<div class="space-y-3">`;

      for (const aId of idsTurma) {
        const nomeAluno = dadosTurma.find(d => d.estudante_id === aId)?.estudante_nome || '';
        const historicoAluno = dadosTurma.filter(d => d.estudante_id === aId);
        const consolidadosAluno = consolidadosTurma.filter(c => c.estudante_id === aId);
        const isExpanded = expandedStudents[aId];

        html += `
          <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div class="flex items-center justify-between p-3 border-b-2 border-black bg-gray-50 cursor-pointer student-expand" data-id="${aId}">
              <span class="font-black text-xs uppercase tracking-wider">🧑‍🎓 ${nomeAluno} — (${historicoAluno.length} lançamentos)</span>
              <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-gray-500"></i>
            </div>
            <div class="${isExpanded ? '' : 'hidden'}" id="student-body-${aId}">
              <div class="p-4">
        `;

        // CONSOLIDADO BIMESTRAL
        if (consolidadosAluno.length > 0) {
          html += `<h4 class="text-xs font-black uppercase tracking-wider mb-3 text-purple-700">📋 Fechamento Bimestral (Conselho de Reforço)</h4>`;
          for (const cons of consolidadosAluno) {
            if (cons.recomendacao_alta) {
              html += `<div class="bg-green-100 border-2 border-green-600 p-3 mb-3"><p class="text-xs font-black text-green-800">🎓 URGENTE: ALTA SUGERIDA (Bim ${cons.bimestre}) — Os professores de reforço indicam que este aluno atingiu autonomia suficiente!</p></div>`;
            } else {
              html += `<div class="bg-blue-50 border-2 border-blue-400 p-3 mb-3"><p class="text-xs font-bold text-blue-800">Situação Bimestral (${cons.bimestre}): <b>${cons.parecer_evolutivo || 'N/A'}</b></p></div>`;
            }
            if (cons.acao_pedagogica) {
              html += `<div class="bg-yellow-50 border-2 border-yellow-600 p-3 mb-3"><p class="text-xs font-bold text-yellow-800">📌 Ação Pedagógica Sugerida para Você na Sala Regular:<br>${cons.acao_pedagogica}</p></div>`;
            }
          }
          html += `<hr class="border-t-2 border-black my-4">`;
        }

        // DIÁRIO CONTÍNUO
        html += `<h4 class="text-xs font-black uppercase tracking-wider mb-3 text-gray-600">📅 Diário Contínuo</h4>`;
        for (const log of historicoAluno) {
          const dp = (log.data_registro || '').split('-');
          const dataF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : log.data_registro;

          if (log.compareceu === 1) {
            const nvRaw = log.nivel_compreensao || 'Não Avaliado';
            const obs = log.observacao ? `<br><span class="italic text-gray-500">Obs: ${log.observacao}</span>` : '';
            const pt = log.participacao || 'Não especificado';
            html += `
              <div class="flex gap-3 mb-3 pb-3 border-b border-gray-200 last:border-0">
                <div class="flex-shrink-0 w-20">
                  <p class="text-[10px] font-black text-gray-400">${dataF}</p>
                  <p class="text-[9px] text-gray-400">Bim ${log.bimestre}</p>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold">🟢 <b>${log.origem_conteudo || ''}</b></p>
                  <p class="text-[10px] text-gray-600"><em>${log.habilidade_trabalhada || ''}</em></p>
                  <p class="text-[10px]">Compreensão: <b>${nvRaw}</b> | Foco: ${pt}${obs}</p>
                  <p class="text-[9px] text-gray-400 mt-0.5"><code>Professor: ${log.prof_reforco_nome} (${log.prof_reforco_area})</code></p>
                </div>
              </div>`;
          } else {
            html += `
              <div class="flex gap-3 mb-3 pb-3 border-b border-gray-200 last:border-0">
                <div class="flex-shrink-0 w-20">
                  <p class="text-[10px] font-black text-gray-400">${dataF}</p>
                  <p class="text-[9px] text-gray-400">Bim ${log.bimestre}</p>
                </div>
                <div class="flex-1">
                  <p class="text-[11px] font-bold text-red-600">🔴 Ausente — ${log.motivo_falta || ''}</p>
                  <p class="text-[9px] text-gray-400 mt-0.5"><code>Lançado por: ${log.prof_reforco_nome} (${log.prof_reforco_area})</code></p>
                </div>
              </div>`;
          }
        }

        // ENCAMINHAMENTOS (stored in 'encaminhamentos-${aId}' placeholder, loaded on expand)
        html += `<div id="enc-area-${aId}"></div>`;

        // FORM NOVO ENCAMINHAMENTO
        html += `
          <hr class="border-t-2 border-black my-4">
          <h4 class="text-xs font-black uppercase tracking-wider mb-3 text-gray-600">📤 Solicitar Foco no Reforço</h4>
          <p class="text-[10px] text-gray-500 font-bold mb-3">Utilize este espaço para pedir que o professor de reforço foque em uma habilidade específica com este aluno nas próximas aulas.</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Área Alvo</label>
              <select id="enc-area-sel-${aId}" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-xs outline-none">
                <option value="Matemática">Matemática</option>
                <option value="Português">Português</option>
              </select>
            </div>
            <div>
              <label class="block text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Qual o foco necessário?</label>
              <input type="text" id="enc-hab-${aId}" placeholder="Ex: Frações, Ortografia" class="w-full border-2 border-black p-2 bg-white font-bold text-xs outline-none">
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Observações para o Prof. de Reforço</label>
            <textarea id="enc-obs-${aId}" class="w-full border-2 border-black p-2 bg-white font-bold text-xs outline-none h-16" placeholder="Detalhes adicionais..."></textarea>
          </div>
          <button class="btn-send-enc w-full bg-purple-600 border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 transition-colors" data-student="${aId}">
            🚀 Enviar Solicitação para o Reforço
          </button>
        `;

        html += `</div></div></div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents();

    // Load encaminhamentos for expanded students
    for (const aId of Object.keys(expandedStudents)) {
      if (expandedStudents[aId]) loadEncaminhamentos(aId);
    }
  }

  async function loadEncaminhamentos(estudanteId) {
    const area = document.getElementById(`enc-area-${estudanteId}`);
    if (!area) return;

    try {
      const encs = await listarEncaminhamentosEnviadosEstudante(estudanteId, session.profId);
      if (!encs.length) { area.innerHTML = ''; return; }

      let html = `<hr class="border-t-2 border-black my-4"><h4 class="text-xs font-black uppercase tracking-wider mb-3 text-gray-600">📥 Status dos Encaminhamentos</h4>`;
      for (const enc of encs) {
        const dp = (enc.data_solicitacao || '').split('-');
        const dtEnc = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : enc.data_solicitacao;

        if (enc.status === 'PENDENTE') {
          html += `<div class="bg-yellow-50 border-2 border-yellow-600 p-3 mb-2"><p class="text-xs font-bold text-yellow-800">🟡 Enviado em ${dtEnc}: Foco em '${enc.habilidade_foco}' (Aguardando Retorno)</p></div>`;
        } else if (enc.status === 'ATENDIDO_PELO_REFORCO') {
          html += `
            <div class="bg-green-50 border-2 border-green-600 p-3 mb-2">
              <p class="text-xs font-bold text-green-800 mb-1">🟢 Respondido pelo Reforço (Foco em '${enc.habilidade_foco}')</p>
              <p class="text-[10px] text-green-700">Re: ${enc.resposta_reforco || 'Marcou como concluído sem comentário escrito.'}</p>
              <button class="btn-ciente mt-2 border-2 border-green-800 bg-green-200 text-green-900 px-3 py-1 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-enc-id="${enc.id}" data-student="${estudanteId}">✅ Estou Ciente da Resposta</button>
            </div>`;
        } else if (enc.status === 'LIDO_PELO_REGENTE') {
          html += `<p class="text-[10px] text-gray-400 italic mb-2">🔕 Histórico (${dtEnc}): Foco em '${enc.habilidade_foco}' resolvido.</p>`;
        }
      }
      area.innerHTML = html;

      // Attach ciente buttons
      area.querySelectorAll('.btn-ciente').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const encId = e.currentTarget.dataset.encId;
          const sId = e.currentTarget.dataset.student;
          await marcarEncaminhamentoLidoRegente(encId);
          loadEncaminhamentos(sId);
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  function attachEvents() {
    // Bimestre filter
    container.querySelector('#reg-bim-filtro')?.addEventListener('change', (e) => {
      bimestreFiltro = e.target.value;
      renderPage();
    });

    // Turma tabs
    container.querySelectorAll('.turma-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        turmaTabAtiva = parseInt(e.currentTarget.dataset.idx);
        expandedStudents = {};
        renderPage();
      });
    });

    // Student expand/collapse
    container.querySelectorAll('.student-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const body = document.getElementById(`student-body-${id}`);
        if (body) {
          const wasHidden = body.classList.contains('hidden');
          body.classList.toggle('hidden');
          expandedStudents[id] = wasHidden;
          if (wasHidden) loadEncaminhamentos(id);
          // Update icon
          const icon = e.currentTarget.querySelector('[data-lucide]');
          if (icon) {
            icon.setAttribute('data-lucide', wasHidden ? 'chevron-up' : 'chevron-down');
            if (window.lucide) lucide.createIcons();
          }
        }
      });
    });

    // Send encaminhamento
    container.querySelectorAll('.btn-send-enc').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const aId = e.currentTarget.dataset.student;
        const areaEl = container.querySelector(`#enc-area-sel-${aId}`);
        const habEl = container.querySelector(`#enc-hab-${aId}`);
        const obsEl = container.querySelector(`#enc-obs-${aId}`);

        if (!habEl?.value?.trim()) {
          alert('Você precisa informar a habilidade foco!');
          return;
        }

        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Enviando...';

        try {
          await criarEncaminhamento({
            estudante_id: aId,
            regente_id: session.profId,
            alvo_area: areaEl?.value || 'Matemática',
            habilidade_foco: habEl.value.trim(),
            observacao: obsEl?.value?.trim() || '',
            data_solicitacao: new Date().toISOString().split('T')[0]
          });
          alert('Aviso enviado! O professor de reforço verá este alerta em seu diário.');
          habEl.value = '';
          obsEl.value = '';
          loadEncaminhamentos(aId);
        } catch (err) {
          console.error(err);
          alert('Erro ao enviar encaminhamento.');
        }
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = '🚀 Enviar Solicitação para o Reforço';
      });
    });
  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">👩‍🏫 Painel da Turma</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando dados do Reforço...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}

function mc(label, value, icon, color) {
  return `<div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
    <div class="flex items-center gap-1.5 mb-1">
      <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400">${label}</span>
    </div>
    <p class="text-xl font-black">${value}</p>
  </div>`;
}
