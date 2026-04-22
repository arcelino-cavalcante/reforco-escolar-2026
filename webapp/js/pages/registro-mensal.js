/**
 * 📊 REGISTRO MENSAL / BIMESTRAL — Prof. Reforço
 */

import {
  listarEstudantes, obterRegentePorTurmaEArea, obterMediaDiariaEstudanteBimestre,
  obterConsolidadoTrimestre, criarConsolidadoMensal, atualizarConsolidadoMensal,
  ESCALA_COMPREENSAO, ESCALA_NOTA_10
} from '../db.js';

export async function renderRegistroMensal(container, session) {
  if (session.perfil !== 'reforco') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`; return;
  }

  let dataSelecionada = new Date().toISOString().split('T')[0];
  let bimestreSelecionado = "I";
  let estudanteSelecionado = "";
  
  let meusEstudantes = [];
  let regenteMatch = null;
  let regExistente = null;
  let mediaDiaria = null;

  container.innerHTML = loadingHTML();
  await loadBaseData();
  renderPage();

  async function loadBaseData() {
    try {
      const todosEstudantes = await listarEstudantes();
      meusEstudantes = todosEstudantes.filter(e => (session.turmasIds || []).includes(String(e.turma_id)));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadStudentData() {
    if (!estudanteSelecionado) {
      regExistente = null; mediaDiaria = null; regenteMatch = null; return;
    }
    const eData = meusEstudantes.find(x => x.id === estudanteSelecionado);
    if (!eData) return;
    
    regenteMatch = await obterRegentePorTurmaEArea(eData.turma_id, session.profArea);
    regExistente = await obterConsolidadoTrimestre(estudanteSelecionado, session.profId, bimestreSelecionado);
    mediaDiaria = await obterMediaDiariaEstudanteBimestre(estudanteSelecionado, session.profId, bimestreSelecionado);
  }

  async function renderPage() {
    await loadStudentData();

    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📊 Desempenho Bimestral</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Lançamento oficial das notas e fechamento do ciclo.</p>
        </div>

        <h4 class="font-black text-lg uppercase tracking-wider mb-4 px-2 border-l-4 border-black">📅 Período Avaliativo - ${session.profArea}</h4>

        <div class="bg-white border-2 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Bimestre de Lançamento</label>
            <select id="rm-bimestre" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
              ${["I", "II", "III", "IV"].map(b => `<option value="${b}" ${b === bimestreSelecionado ? 'selected' : ''}>Bimestre ${b}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Data do Relatório</label>
            <input type="date" id="rm-data" value="${dataSelecionada}" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
          </div>
        </div>
    `;

    if (meusEstudantes.length === 0) {
      html += `<div class="bg-blue-50 border-2 border-black p-4 text-center">
        <p class="font-bold text-blue-800">Nenhum estudante matriculado nas suas turmas atualmente.</p>
      </div></div>`;
      container.innerHTML = html; attachEvents(); return;
    }

    html += `
        <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
          <label class="block text-sm font-black uppercase tracking-wide text-black mb-2">🎯 Selecione o Estudante para Avaliar</label>
          <select id="rm-aluno" class="w-full border-2 border-black p-3 bg-yellow-50 font-black text-sm outline-none uppercase mb-2">
            <option value="">Selecione...</option>
            ${meusEstudantes.map(e => `<option value="${e.id}" ${e.id === estudanteSelecionado ? 'selected' : ''}>${e.nome} - ${e.turma_nome}</option>`).join('')}
          </select>
    `;

    if (estudanteSelecionado) {
      if (regenteMatch) {
        html += `<p class="text-[10px] text-gray-500 font-bold italic mb-4">🤝 Relatório Oficial será espelhado no painel do Diretor e do Regente: <b>${regenteMatch.nome}</b></p>`;
      }

      if (regExistente) {
        html += `<div class="bg-green-50 border-2 border-black p-3 mb-6"><p class="text-green-800 font-bold text-xs">✅ O Consolidado do Bimestre ${bimestreSelecionado} já foi fechado! Você pode alterar as notas abaixo.</p></div>`;
      }

      html += renderEscalaNota10();

      const formTitle = regExistente ? `Edição de Boletim - Bimestre ${bimestreSelecionado}` : `Novo Boletim - Bimestre ${bimestreSelecionado}`;
      const btnLabel = regExistente ? `💾 Salvar Alterações` : `🚀 Publicar Relatório`;

      let fallbackVal = mediaDiaria ? Math.max(1, Math.min(10, Math.round(mediaDiaria * 2.5))) : 5;
      
      html += `<div class="border-2 border-black p-4 mt-4 bg-gray-50">
        <h3 class="font-black text-sm uppercase mb-4">${formTitle}</h3>
      `;

      if (mediaDiaria !== null && !regExistente) {
        const idx = Math.min(3, Math.max(0, Math.round(mediaDiaria) - 1));
        const nivelStr = ESCALA_COMPREENSAO[idx];
        html += `<p class="text-[10px] text-blue-600 font-bold italic mb-4 bg-blue-100 p-2 border border-black">🤖 Sugestão baseada na média diária de <b>${mediaDiaria}/4</b> (${nivelStr}) nos Diários deste bimestre.</p>`;
      }

      if (session.profArea === "Matemática") {
        html += `<h5 class="font-black text-xs uppercase mb-3 text-black">🧮 Habilidades Matemáticas (Escala de 1 a 10)</h5>
          <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            ${numInput('mat_adicao', 'Adição', regExistente?.mat_adicao ?? fallbackVal)}
            ${numInput('mat_subtracao', 'Subtração', regExistente?.mat_subtracao ?? fallbackVal)}
            ${numInput('mat_multiplicacao', 'Multiplicação', regExistente?.mat_multiplicacao ?? fallbackVal)}
            ${numInput('mat_divisao', 'Divisão', regExistente?.mat_divisao ?? fallbackVal)}
            ${numInput('mat_resolucao', 'Resolução de Problemas', regExistente?.mat_resolucao ?? fallbackVal)}
          </div>
        `;
      } else if (session.profArea === "Português") {
        html += `<h5 class="font-black text-xs uppercase mb-3 text-black">📝 Habilidades de Linguagem (Escala de 1 a 10)</h5>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            ${numInput('port_escrita', 'Nível de Escrita', regExistente?.port_escrita ?? fallbackVal)}
            ${numInput('port_leitura', 'Nível de Leitura', regExistente?.port_leitura ?? fallbackVal)}
            ${numInput('port_interpretacao', 'Interpretação Textual', regExistente?.port_interpretacao ?? fallbackVal)}
            ${numInput('port_pontuacao', 'Pontuação e Acent.', regExistente?.port_pontuacao ?? fallbackVal)}
          </div>
        `;
      } else {
        html += `<div class="bg-yellow-100 border-2 border-black p-3 mb-4"><p class="text-xs text-yellow-800 font-bold">Sua área não está configurada como Português ou Matemática. Preencha apenas o desfecho geral.</p></div>`;
      }

      const valParecer = regExistente?.parecer_evolutivo || "Avançou parcialmente";
      const valAlta = regExistente?.recomendacao_alta || false;

      html += `<div class="border-t-4 border-black pt-4 mt-6">
        <h5 class="font-black text-xs uppercase mb-4 text-black">🔎 Desfecho Final Pedagógico (Cirúrgico)</h5>
        
        <div class="mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Situação do Aprendizado do Aluno neste Bimestre</label>
          <select id="rm-parecer" class="w-full border-2 border-black p-2.5 bg-white font-bold text-sm outline-none">
            ${["Avançou bastante", "Avançou parcialmente", "Não conseguiu avançar (Estagnado)"].map(o => `<option value="${o}" ${o === valParecer ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>

        <div class="mb-4 flex items-center gap-3 p-3 border-2 border-black bg-white cursor-pointer hover:bg-gray-50" onclick="document.getElementById('rm-alta').click()">
          <input type="checkbox" id="rm-alta" class="w-5 h-5 accent-black" ${valAlta ? 'checked' : ''} onclick="event.stopPropagation()">
          <div>
            <p class="font-black text-sm uppercase">🎓 RECOMENDAR ALTA DO REFORÇO?</p>
            <p class="text-[10px] font-bold text-gray-500">Ative se o aluno atingiu fluência mínima para acompanhar a sala regular.</p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">📌 Ação Pedagógica Sugerida para o Regente</label>
          <textarea id="rm-acao" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16" placeholder="Ex: Manter sentado à frente">${regExistente?.acao_pedagogica || ''}</textarea>
        </div>

        <div class="mb-6">
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Observação Geral Privada (Opcional)</label>
          <textarea id="rm-obs" class="w-full border-2 border-black p-2.5 bg-white font-bold text-xs outline-none h-16">${regExistente?.observacao_geral || ''}</textarea>
        </div>

        <button id="btn-save-rm" class="w-full bg-black border-2 border-black text-white px-4 py-3 font-black uppercase tracking-wider text-sm btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-800 flex items-center justify-center gap-2">
          <i data-lucide="check" class="w-5 h-5"></i> ${btnLabel}
        </button>
      </div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function numInput(id, label, val) {
    return `<div>
      <label class="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 truncate">${label}</label>
      <input type="number" id="rm-${id}" min="1" max="10" value="${val}" class="w-full border-2 border-black p-2 font-black text-center text-lg bg-white outline-none focus:ring-2 focus:ring-black input-rm">
    </div>`;
  }

  function renderEscalaNota10() {
    return `
      <div class="mb-5 border-2 border-black bg-white p-3">
        <p class="text-[10px] font-black uppercase tracking-wider mb-2">🧭 Guia da Escala 1–10 (Leitura Pedagógica)</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${ESCALA_NOTA_10.map((item) => `
            <div class="border border-black bg-gray-50 p-2">
              <p class="text-[10px] font-black">Nível ${item.nota} - ${item.titulo}</p>
              <p class="text-[10px] text-gray-700 font-bold mt-0.5">${item.descricao}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function attachEvents() {
    const cn = container;
    
    cn.querySelector('#rm-bimestre')?.addEventListener('change', (e) => { bimestreSelecionado = e.target.value; renderPage(); });
    cn.querySelector('#rm-data')?.addEventListener('change', (e) => { dataSelecionada = e.target.value; });
    cn.querySelector('#rm-aluno')?.addEventListener('change', (e) => { estudanteSelecionado = e.target.value; renderPage(); });

    cn.querySelector('#btn-save-rm')?.addEventListener('click', async () => {
      const btn = cn.querySelector('#btn-save-rm');
      btn.innerHTML = 'Salvando...'; btn.disabled = true;

      const gv = (id) => { const el = cn.querySelector('#rm-'+id); return el ? parseInt(el.value) || null : null; };
      
      const payload = {
        estudante_id: estudanteSelecionado,
        prof_id: session.profId,
        prof_regente_id: regenteMatch ? regenteMatch.id : null,
        data_registro: dataSelecionada,
        bimestre: bimestreSelecionado,
        mat_adicao: gv('mat_adicao'), mat_subtracao: gv('mat_subtracao'), mat_multiplicacao: gv('mat_multiplicacao'), mat_divisao: gv('mat_divisao'), mat_resolucao: gv('mat_resolucao'),
        port_escrita: gv('port_escrita'), port_leitura: gv('port_leitura'), port_interpretacao: gv('port_interpretacao'), port_pontuacao: gv('port_pontuacao'),
        parecer_evolutivo: cn.querySelector('#rm-parecer').value,
        recomendacao_alta: cn.querySelector('#rm-alta').checked,
        acao_pedagogica: cn.querySelector('#rm-acao').value || null,
        observacao_geral: cn.querySelector('#rm-obs').value || null
      };

      try {
        if (regExistente) {
          await atualizarConsolidadoMensal(regExistente.id, payload);
          alert('Alterações salvas com sucesso!');
        } else {
          await criarConsolidadoMensal(payload);
          alert('Relatório publicado com sucesso!');
        }
      } catch (e) {
        console.error(e); alert('Erro ao salvar relatório.');
      }
      renderPage();
    });
  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📊 Desempenho Bimestral</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}
