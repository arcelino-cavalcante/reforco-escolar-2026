/**
 * 📝 FICHA DIÁRIA — Prof. Reforço
 */

import { listarTurmas, listarEstudantes, criarRegistroDiario, atualizarRegistroDiario, excluirRegistroDiario, listarRegistrosDiarios, obterRegentePorTurmaEArea, obterEncaminhamentosPendentes, concluirEncaminhamento, contarPresencasEstudante } from '../db.js';

const HABILIDADES_MATEMATICA = ["Adição", "Subtração", "Divisão", "Multiplicação", "Resolução de problemas simples", "Outro"];
const HABILIDADES_PORTUGUES = ["Leitura e Compreensão Textual", "Produção de Texto (Escrita)", "Ortografia e Gramática", "Fluência Leitora", "Caligrafia e Traçado", "Interpretação Avançada", "Vocabulário", "Outro"];
const MOTIVOS_FALTA = ["Atestado Médico / Doença", "Problema de Transporte", "Falta do Professor (Sua falta)", "Feriado / Recesso", "Esqueceu do Reforço", "Evento na Escola", "Outro Motivo"];
const NIVEIS_ENGAJAMENTO = ["Muito Focado e Participativo", "Participação Regular", "Desatento / Disperso", "Agitado / Inquieto", "Recusou-se a Realizar Tarefas"];
const TIPOS_ATIVIDADE = ["Impressa", "Atividade Lúdica", "Jogo", "Atividade em Grupo", "Outro"];
const ESTADOS_EMOCIONAIS = ["Não Observado", "Tranquilo / Calmo", "Triste / Apático", "Irritado / Frustrado", "Ansioso", "Eufórico / Muito Agitado"];
const NIVEIS_COMPREENSAO = ["Não compreendeu a habilidade", "Compreendeu com muita intervenção", "Compreendeu com pouca intervenção", "Autônomo (Domínio total)"];

export async function renderRegistroDiario(container, session) {
  if (session.perfil !== 'reforco') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  let dataSelecionada = new Date().toISOString().split('T')[0];
  let bimestreSelecionado = "I";
  let turmaSelecionada = "Todas as Turmas";

  let turmasDoProf = [];
  let todosEstudantes = [];
  let registrosHoje = [];
  
  let _editingId = null;
  let _deletingId = null;

  container.innerHTML = loadingHTML();
  await loadBaseData();
  renderPage();

  async function loadBaseData() {
    try {
      const allTurmas = await listarTurmas();
      turmasDoProf = allTurmas.filter(t => (session.turmasIds || []).includes(String(t.id)));
      todosEstudantes = await listarEstudantes();
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDailyRecords() {
    try {
      registrosHoje = await listarRegistrosDiarios(dataSelecionada, session.profId);
      if (turmaSelecionada !== "Todas as Turmas") {
        registrosHoje = registrosHoje.filter(r => r.turma_nome === turmaSelecionada);
      }
    } catch (e) {
      console.error(e);
      registrosHoje = [];
    }
  }

  async function renderPage() {
    await loadDailyRecords();

    const meusEstudantesBase = todosEstudantes.filter(e => (session.turmasIds || []).includes(String(e.turma_id)));
    let meusEstudantes = meusEstudantesBase;
    
    if (turmaSelecionada !== "Todas as Turmas") {
      const selT = turmasDoProf.find(t => t.nome === turmaSelecionada);
      if (selT) meusEstudantes = meusEstudantesBase.filter(e => e.turma_id === selT.id);
    }

    const registrosPorEstudante = new Map(
      registrosHoje.map((r) => [String(r.estudante_id), r])
    );
    const alunosDoDia = meusEstudantes.map((e) => ({
      ...e,
      jaRegistrado: registrosPorEstudante.has(String(e.id))
    }));
    const pendentesQtd = alunosDoDia.filter((e) => !e.jaRegistrado).length;
    const concluidosQtd = alunosDoDia.length - pendentesQtd;

    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📝 Ficha Diária</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Acompanhe e cruze dados vitais de Reforço x Sala de Aula.</p>
        </div>
        
        <h4 class="font-black text-lg uppercase tracking-wider mb-4 px-2 border-l-4 border-black">🎓 Novo Lançamento - ${session.profArea}</h4>

        <!-- HEADER CONTROLS -->
        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bimestre</label>
              <select id="rd-bimestre" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                ${["I", "II", "III", "IV"].map(b => `<option value="${b}" ${b === bimestreSelecionado ? 'selected' : ''}>Bimestre ${b}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Data</label>
              <input type="date" id="rd-data" value="${dataSelecionada}" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
              <select id="rd-turma" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                <option value="Todas as Turmas">Todas as Turmas</option>
                ${turmasDoProf.map(t => `<option value="${t.nome}" ${t.nome === turmaSelecionada ? 'selected' : ''}>${t.nome}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

    `;

    if (turmasDoProf.length === 0) {
      html += `<div class="bg-yellow-50 border-2 border-black p-4 text-center">
        <p class="font-bold text-yellow-800">⚠️ Você não está vinculado a nenhuma turma.</p>
      </div>`;
    } else if (meusEstudantes.length === 0) {
      html += `<div class="bg-blue-50 border-2 border-black p-4 text-center">
        <p class="font-bold text-blue-800">Nenhum estudante matriculado nesta seleção.</p>
      </div>`;
    } else {
      html += renderFilaDoDia(alunosDoDia, pendentesQtd, concluidosQtd);
    }

    html += renderAtendidos();

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents(alunosDoDia);
  }

  function renderFilaDoDia(alunosDoDia, pendentesQtd, concluidosQtd) {
    let habOptions = session.profArea === "Matemática" ? HABILIDADES_MATEMATICA : (session.profArea === "Português" ? HABILIDADES_PORTUGUES : ["Geral", "Outro"]);
    const alunoInicial = alunosDoDia.find((e) => !e.jaRegistrado) || alunosDoDia[0];
    const alunoInicialId = alunoInicial ? String(alunoInicial.id) : '';

    return `
      <div class="bg-white border-2 border-black p-5 mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          1️⃣ Fila do Dia
        </h3>

        <div class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500">✅ Feitos Hoje: ${concluidosQtd}</p>
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-500">⏳ Pendentes Hoje: ${pendentesQtd}</p>
        </div>
        ${pendentesQtd === 0 ? `
          <div class="mb-4 bg-green-50 border-2 border-black p-3 text-center">
            <p class="font-black text-green-700 uppercase tracking-widest text-xs">Todos os estudantes já foram lançados nesta data.</p>
            <p class="font-bold text-green-800 text-[10px] mt-1">Você pode revisar/editar no quadro de atendidos abaixo.</p>
          </div>
        ` : ''}
        
        <div class="mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Selecione o Estudante</label>
          <select id="rd-aluno" class="w-full border-2 border-black p-2.5 bg-yellow-50 font-black text-sm outline-none uppercase">
            ${alunosDoDia.map((e) => {
              const statusIcon = e.jaRegistrado ? '✅' : '⏳';
              const statusLabel = e.jaRegistrado ? 'Feito' : 'Pendente';
              const selected = String(e.id) === alunoInicialId ? 'selected' : '';
              return `<option value="${e.id}" ${selected}>${statusIcon} ${e.nome} - ${e.turma_nome} (${statusLabel})</option>`;
            }).join('')}
          </select>
          <div id="rd-regente-info" class="text-[10px] font-bold text-gray-500 mt-1 italic">Carregando vínculo com regente...</div>
          <div id="rd-status-aluno" class="text-[10px] font-black mt-1"></div>
        </div>

        <div class="border-t-2 border-black pt-4 mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Aluno Compareceu?</label>
          <div class="flex gap-4">
            <label class="font-bold text-sm flex items-center gap-2 cursor-pointer">
              <input type="radio" name="rd-comp" value="Sim" checked class="w-4 h-4 accent-black"> Sim
            </label>
            <label class="font-bold text-sm flex items-center gap-2 cursor-pointer text-red-600">
              <input type="radio" name="rd-comp" value="Não" class="w-4 h-4 accent-red-600"> Não (Falta)
            </label>
          </div>
        </div>

        <!-- FORM SIM -->
        <div id="form-sim" class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">O que foi trabalhado?</label>
            <select id="rd-origem" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              <option value="Conteúdo base do Reforço">Conteúdo base do Reforço</option>
              <option value="Conteúdo da Sala de Aula">Conteúdo da Sala de Aula</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Habilidade de ${session.profArea} *</label>
            <select id="rd-hab" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${habOptions.map(h => `<option value="${h}">${h}</option>`).join('')}
            </select>
          </div>
          <div id="rd-hab-outro-container" class="hidden">
            <input type="text" id="rd-hab-outro" placeholder="Especifique a Habilidade *" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Tipo de Atividade</label>
              <select id="rd-tipo-ativ" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                ${TIPOS_ATIVIDADE.map(h => `<option value="${h}">${h}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Estado Emocional</label>
              <select id="rd-emocional" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                ${ESTADOS_EMOCIONAIS.map(h => `<option value="${h}">${h}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Compreensão</label>
              <select id="rd-comp-nivel" class="w-full border-2 border-black p-2.5 bg-blue-50 font-bold text-sm outline-none">
                ${NIVEIS_COMPREENSAO.map(h => `<option value="${h}">${h}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Engajamento</label>
              <select id="rd-engajamento" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
                ${NIVEIS_ENGAJAMENTO.map(h => `<option value="${h}">${h}</option>`).join('')}
              </select>
            </div>
          </div>

          <div id="rd-dif-container">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">⚠️ Dificuldade Latente Hoje</label>
            <input type="text" id="rd-dif" placeholder="Ex: Errou a regra dos sinais na prática" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Observação Geral</label>
            <textarea id="rd-obs" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none h-20"></textarea>
          </div>
        </div>

        <!-- FORM NÃO -->
        <div id="form-nao" class="hidden space-y-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Motivo da Ausência</label>
            <select id="rd-motivo" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${MOTIVOS_FALTA.map(h => `<option value="${h}">${h}</option>`).join('')}
            </select>
          </div>
        </div>

        <button id="btn-salvar-rd" class="mt-6 w-full bg-black border-2 border-black text-white px-4 py-3 font-black uppercase tracking-wider text-sm btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-800 flex items-center justify-center gap-2">
          <i data-lucide="check" class="w-5 h-5"></i> Salvar Ficha
        </button>
      </div>
    `;
  }

  function renderAtendidos() {
    return `
      <div class="mb-8">
        <h3 class="text-sm font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          2️⃣ Estudantes Já Atendidos Hoje (${registrosHoje.length})
        </h3>
        
        ${registrosHoje.length === 0 ? `
          <div class="bg-gray-50 border-2 border-black p-4 text-center">
            <p class="font-bold text-gray-500">Nenhum relato gravado para esta data.</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${registrosHoje.map(r => renderCardRegistro(r)).join('')}
          </div>
        `}
      </div>
    `;
  }

  function renderCardRegistro(r) {
    const isEditing = _editingId === r.id;
    const isDeleting = _deletingId === r.id;
    const isPresent = r.compareceu === 1;

    let html = `
      <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        
        <!-- HEADER -->
        <div class="flex items-center justify-between p-3 border-b-2 border-black bg-gray-50 cursor-pointer" onclick="document.getElementById('body-${r.id}').classList.toggle('hidden')">
          <div class="flex items-center gap-2">
            <span class="text-lg">${isPresent ? '🟢' : '🔴'}</span>
            <div>
              <p class="font-black text-xs uppercase tracking-wider truncate">${r.estudante_nome}</p>
              <p class="text-[9px] font-bold text-gray-500 uppercase">${r.turma_nome}</p>
            </div>
          </div>
        </div>
        
        <!-- BODY COLLAPSIBLE -->
        <div id="body-${r.id}" class="hidden p-4">
    `;

    // VIEW MODE
    if (!isEditing && !isDeleting) {
      if (isPresent) {
        html += `<p class="text-xs font-bold mb-1"><span class="text-gray-500 uppercase tracking-wider text-[10px] mr-1">Trabalhou:</span> ${r.origem_conteudo} - <span class="bg-blue-100 px-1 border border-black">${r.habilidade_trabalhada}</span></p>`;
        html += `<p class="text-xs font-bold mb-3"><span class="text-gray-500 uppercase tracking-wider text-[10px] mr-1">Compreensão:</span> ${r.nivel_compreensao}</p>`;
      } else {
        html += `<p class="text-xs font-bold text-red-600 mb-3">Falta: ${r.motivo_falta}</p>`;
      }

      html += `
          <div class="flex gap-2">
            <button class="btn-edit-rd flex-1 border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100" data-id="${r.id}">✏️ Editar</button>
            <button class="btn-del-rd flex-1 border-2 border-red-900 bg-red-100 text-red-900 px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(127,24,24,1)] hover:bg-red-200" data-id="${r.id}">🗑️</button>
          </div>
      `;
    }

    // DELETE CONFIRMATION
    if (isDeleting) {
      html += `
        <div class="bg-red-50 border-2 border-red-900 p-3 mb-2">
          <p class="text-xs font-bold text-red-900 mb-2">Tem certeza que deseja excluir o registro deste aluno?</p>
          <div class="flex gap-2">
            <button class="btn-conf-esc w-1/2 border-2 border-red-900 bg-red-600 text-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(127,24,24,1)]" data-id="${r.id}">Sim, Excluir</button>
            <button class="btn-canc-esc w-1/2 border-2 border-black bg-white text-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
          </div>
        </div>
      `;
    }

    // EDIT FORM (Basic just presence change for simplicity in prototype)
    if (isEditing) {
      html += `
        <div class="bg-yellow-50 border-2 border-black p-3 mb-2">
          <p class="text-[10px] font-black uppercase mb-2">Editar Ficha (Simplificado)</p>
          <select id="edit-comp-${r.id}" class="w-full border-2 border-black p-2 font-bold text-xs outline-none mb-2">
            <option value="1" ${isPresent ? 'selected' : ''}>Presente</option>
            <option value="0" ${!isPresent ? 'selected' : ''}>Faltou</option>
          </select>
          <div class="flex gap-2 mt-2">
            <button class="btn-save-edit w-1/2 border-2 border-black bg-green-400 text-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" data-id="${r.id}">Salvar</button>
            <button class="btn-canc-edit w-1/2 border-2 border-black bg-white text-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
    return html;
  }

  function attachEvents(alunosDoDia) {
    const cn = container;

    // Filters update
    cn.querySelector('#rd-bimestre')?.addEventListener('change', (e) => { bimestreSelecionado = e.target.value; renderPage(); });
    cn.querySelector('#rd-data')?.addEventListener('change', (e) => { dataSelecionada = e.target.value; renderPage(); });
    cn.querySelector('#rd-turma')?.addEventListener('change', (e) => { turmaSelecionada = e.target.value; renderPage(); });

    // Fila radio toggles
    cn.querySelectorAll('input[name="rd-comp"]')?.forEach(el => {
      el.addEventListener('change', (e) => {
        if (e.target.value === 'Sim') {
          cn.querySelector('#form-sim').classList.remove('hidden');
          cn.querySelector('#form-nao').classList.add('hidden');
        } else {
          cn.querySelector('#form-sim').classList.add('hidden');
          cn.querySelector('#form-nao').classList.remove('hidden');
        }
      });
    });

    // Hab outo toggle
    cn.querySelector('#rd-hab')?.addEventListener('change', (e) => {
      const isOutro = e.target.value === 'Outro';
      if (isOutro) cn.querySelector('#rd-hab-outro-container').classList.remove('hidden');
      else cn.querySelector('#rd-hab-outro-container').classList.add('hidden');
    });

    // Comp change to hide/show dif latente
    cn.querySelector('#rd-comp-nivel')?.addEventListener('change', (e) => {
      const isAuto = e.target.value === "Autônomo (Domínio total)";
      if (isAuto) cn.querySelector('#rd-dif-container').classList.add('hidden');
      else cn.querySelector('#rd-dif-container').classList.remove('hidden');
    });

    // Update regente on student change
    const alSel = cn.querySelector('#rd-aluno');
    if (alSel) {
      const atualizarContextoAluno = async () => {
        const estId = alSel.value;
        const est = alunosDoDia.find((x) => String(x.id) === String(estId));
        const info = cn.querySelector('#rd-regente-info');
        const status = cn.querySelector('#rd-status-aluno');
        const btnSalvar = cn.querySelector('#btn-salvar-rd');

        if (!est) {
          if (info) info.textContent = "Sem estudante selecionado.";
          if (status) status.textContent = "";
          if (btnSalvar) {
            btnSalvar.disabled = true;
            btnSalvar.classList.add('opacity-60', 'cursor-not-allowed');
          }
          return;
        }

        if (info) info.textContent = "Buscando regente...";
        const reg = await obterRegentePorTurmaEArea(est.turma_id, session.profArea);
        if (info) {
          if (reg) info.innerHTML = `🤝 Parceria ativa: Vinculado ao Regente <b>${reg.nome}</b>`;
          else info.textContent = "Sem regente vinculado para esta área.";
        }
        alSel._regenteId = reg ? reg.id : null;

        if (btnSalvar) {
          if (est.jaRegistrado) {
            btnSalvar.disabled = true;
            btnSalvar.classList.add('opacity-60', 'cursor-not-allowed');
            btnSalvar.innerHTML = `<i data-lucide="check-check" class="w-5 h-5"></i> Já Registrado Hoje`;
          } else {
            btnSalvar.disabled = false;
            btnSalvar.classList.remove('opacity-60', 'cursor-not-allowed');
            btnSalvar.innerHTML = `<i data-lucide="check" class="w-5 h-5"></i> Salvar Ficha`;
          }
        }

        if (status) {
          if (est.jaRegistrado) {
            status.className = "text-[10px] font-black mt-1 text-green-700";
            status.textContent = "✅ Este estudante já foi lançado nesta data. Para corrigir, use 'Editar' na lista abaixo.";
          } else {
            status.className = "text-[10px] font-black mt-1 text-amber-700";
            status.textContent = "⏳ Este estudante ainda está pendente nesta data.";
          }
        }

        if (window.lucide) lucide.createIcons();
      };

      alSel.addEventListener('change', atualizarContextoAluno);
      // trigger select first
      alSel.dispatchEvent(new Event('change'));
    }

    // Save New Form
    cn.querySelector('#btn-salvar-rd')?.addEventListener('click', async () => {
      const btn = cn.querySelector('#btn-salvar-rd');
      btn.innerHTML = 'Salvando...'; btn.disabled = true;

      const comp = cn.querySelector('input[name="rd-comp"]:checked').value;
      const estId = alSel.value;
      const rId = alSel._regenteId;

      let hab = cn.querySelector('#rd-hab').value;
      if (hab === 'Outro') hab = cn.querySelector('#rd-hab-outro').value;

      try {
        const res = await criarRegistroDiario({
          estudante_id: estId,
          prof_id: session.profId,
          data_registro: dataSelecionada,
          bimestre: bimestreSelecionado,
          prof_regente_id: rId,
          compareceu: comp === "Sim" ? 1 : 0,
          motivo_falta: comp === "Não" ? cn.querySelector('#rd-motivo').value : null,
          origem_conteudo: comp === "Sim" ? cn.querySelector('#rd-origem').value : null,
          habilidade_trabalhada: comp === "Sim" ? hab : null,
          nivel_compreensao: comp === "Sim" ? cn.querySelector('#rd-comp-nivel').value : null,
          participacao: comp === "Sim" ? cn.querySelector('#rd-engajamento').value : null,
          dificuldade_latente: (comp === "Sim" && cn.querySelector('#rd-comp-nivel').value !== "Autônomo (Domínio total)") ? cn.querySelector('#rd-dif').value : null,
          tipo_atividade: comp === "Sim" ? cn.querySelector('#rd-tipo-ativ').value : null,
          estado_emocional: comp === "Sim" ? cn.querySelector('#rd-emocional').value : null,
          observacao: comp === "Sim" ? cn.querySelector('#rd-obs').value : null
        });

        if (!res) alert('Registro já existe para este dia!');
      } catch (e) {
        console.error(e); alert('Erro ao salvar ficha.');
      }
      renderPage();
    });

    // List Actions
    cn.querySelectorAll('.btn-del-rd').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); _deletingId = e.currentTarget.dataset.id; _editingId = null; renderPage();
    }));
    cn.querySelectorAll('.btn-edit-rd').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); _editingId = e.currentTarget.dataset.id; _deletingId = null; renderPage();
    }));
    cn.querySelectorAll('.btn-canc-esc, .btn-canc-edit').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); _editingId = null; _deletingId = null; renderPage();
    }));
    cn.querySelectorAll('.btn-conf-esc').forEach(b => b.addEventListener('click', async (e) => {
      await excluirRegistroDiario(e.currentTarget.dataset.id);
      _deletingId = null; renderPage();
    }));
    cn.querySelectorAll('.btn-save-edit').forEach(b => b.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const v = cn.querySelector(`#edit-comp-${id}`).value;
      await atualizarRegistroDiario(id, { compareceu: parseInt(v) });
      _editingId = null; renderPage();
    }));

  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📝 Ficha Diária</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}
