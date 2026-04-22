/**
 * 📜 HISTÓRICO — Prof. Reforço
 */

import { listarTurmas, listarRegistrosDiariosTrintaDias, listarConsolidadosPorProfReforco } from '../db.js';

export async function renderHistorico(container, session) {
  if (session.perfil !== 'reforco') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`; return;
  }

  let activeTab = 'diario';
  let turmasDoProf = [];
  let turmaSelecionada = "";
  
  let registrosDiarios = [];
  let registrosMensais = [];
  let loadingTab = false;

  container.innerHTML = loadingHTML();
  await loadBaseData();
  renderPage();

  async function loadBaseData() {
    try {
      const allTurmas = await listarTurmas();
      turmasDoProf = allTurmas.filter(t => (session.turmasIds || []).includes(String(t.id)));
      if (turmasDoProf.length > 0) turmaSelecionada = turmasDoProf[0].id;
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTabData() {
    loadingTab = true;
    renderPage();
    try {
      if (activeTab === 'diario' && turmaSelecionada) {
        registrosDiarios = await listarRegistrosDiariosTrintaDias(session.profId, turmaSelecionada);
      } else if (activeTab === 'mensal') {
        registrosMensais = await listarConsolidadosPorProfReforco(session.profId);
      }
    } catch (e) {
      console.error(e);
    }
    loadingTab = false;
    renderPage();
  }

  function renderPage() {
    let html = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📜 Histórico de Registros</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Consulte seus lançamentos diários e mensais recentes.</p>
        </div>

        <!-- TABS -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button id="tab-diario" class="flex-none px-4 py-2 border-2 border-black font-black uppercase tracking-wider text-xs whitespace-nowrap transition-colors ${activeTab === 'diario' ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}">
            📅 Registro Diário (30 dias)
          </button>
          <button id="tab-mensal" class="flex-none px-4 py-2 border-2 border-black font-black uppercase tracking-wider text-xs whitespace-nowrap transition-colors ${activeTab === 'mensal' ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-black hover:bg-gray-100'}">
            📊 Registro Mensal
          </button>
        </div>
    `;

    if (loadingTab) {
      html += `<div class="text-center py-8"><div class="h-8 w-8 mx-auto skeleton rounded-full mb-2"></div><p class="text-xs font-bold text-gray-400 uppercase">Carregando dados...</p></div>`;
    } else {
      if (activeTab === 'diario') html += renderTabDiario();
      else html += renderTabMensal();
    }

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    attachEvents();

    if (!loadingTab && ((activeTab === 'diario' && registrosDiarios.length === 0) || (activeTab === 'mensal' && registrosMensais.length === 0))) {
        // Trigger load just once if empty, since first render might happen before trigger
        if (turmaSelecionada && activeTab === 'diario' && registrosDiarios.length === 0 && !container.hasLoadedDiario) {
            container.hasLoadedDiario = true;
            loadTabData();
        }
        if (activeTab === 'mensal' && registrosMensais.length === 0 && !container.hasLoadedMensal) {
            container.hasLoadedMensal = true;
            loadTabData();
        }
    }
  }

  function renderTabDiario() {
    if (turmasDoProf.length === 0) return `<div class="bg-yellow-50 border-2 border-black p-4 text-yellow-800 font-bold">Você não está vinculado a nenhuma turma.</div>`;

    let html = `
      <div class="mb-4">
        <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Selecione a Turma</label>
        <select id="hist-turma" class="w-full md:w-1/2 border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none">
          ${turmasDoProf.map(t => `<option value="${t.id}" ${t.id === turmaSelecionada ? 'selected' : ''}>${t.nome}</option>`).join('')}
        </select>
      </div>
    `;

    if (registrosDiarios.length === 0) {
      html += `<div class="bg-gray-50 border-2 border-black p-4 text-center"><p class="font-bold text-gray-500">Nenhum registro encontrado nos últimos 30 dias para esta turma.</p></div>`;
      return html;
    }

    // Agrupar por data
    const byDate = {};
    registrosDiarios.forEach(r => {
      const d = r.data_registro;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });

    const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));
    
    html += `<div class="space-y-4">`;
    for (const data of dates) {
      const parts = data.split('-');
      const dForm = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : data;
      const regs = byDate[data];
      
      html += `
        <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div class="bg-black text-white px-3 py-2 flex justify-between items-center cursor-pointer" onclick="document.getElementById('hd-${data}').classList.toggle('hidden')">
            <span class="text-xs font-black uppercase tracking-wider flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4 text-yellow-400"></i> Dia ${dForm}</span>
            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400"></i>
          </div>
          <div id="hd-${data}" class="divide-y-2 divide-black hidden">
            ${regs.map(r => {
              const isP = r.compareceu === 1;
              const emoji = isP ? '🟢' : '🔴';
              
              let infoHtml = ``;
              if (isP) {
                infoHtml += `<p class="text-[10px] text-gray-500 mt-1">Habilidade: ${r.habilidade_trabalhada} | Compreensão: ${r.nivel_compreensao}</p>`;
                const extras = [];
                if (r.tipo_atividade) extras.push(`Ativ: ${r.tipo_atividade}`);
                if (r.participacao) extras.push(`Foco: ${r.participacao}`);
                if (r.estado_emocional && r.estado_emocional !== "Não Observado") extras.push(`Emocional: ${r.estado_emocional}`);
                if (extras.length > 0) infoHtml += `<p class="text-[9px] text-gray-400 mt-0.5">${extras.join(' | ')}</p>`;
                if (r.observacao) infoHtml += `<p class="text-[10px] italic text-gray-600 mt-1 border-l-2 border-gray-300 pl-2">Obs: ${r.observacao}</p>`;
              } else {
                infoHtml += `<p class="text-[10px] text-red-600 font-bold mt-1">Faltou: ${r.motivo_falta}</p>`;
              }

              return `
                <div class="p-3 flex justify-between items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-black truncate">${r.estudante_nome}</p>
                    ${infoHtml}
                  </div>
                  <div class="font-black text-[10px] uppercase border px-2 py-1 ${isP ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-600 text-red-700 bg-red-50'}">
                    ${isP ? 'Presente' : 'Falta'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    html += `</div>`;
    return html;
  }

  function renderTabMensal() {
    if (registrosMensais.length === 0) {
      return `<div class="bg-gray-50 border-2 border-black p-4 text-center"><p class="font-bold text-gray-500">Nenhum registro mensal encontrado.</p></div>`;
    }

    return `<div class="space-y-4">
      ${registrosMensais.map(c => {
        const parts = (c.data_registro||'').split('-');
        const dForm = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : c.data_registro;
        
        let habsHtml = '';
        if (c.mat_adicao !== null) {
          habsHtml = `- Matemática: Adição(${c.mat_adicao}), Subtr(${c.mat_subtracao}), Multi(${c.mat_multiplicacao}), Divi(${c.mat_divisao})`;
        } else if (c.port_leitura !== null) {
          habsHtml = `- Português: Leitura(${c.port_leitura}), Escrita(${c.port_escrita}), Interp.(${c.port_interpretacao})`;
        }

        return `
        <div class="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div class="bg-gray-100 border-b-2 border-black px-3 py-2 flex justify-between items-center cursor-pointer" onclick="document.getElementById('hm-${c.id}').classList.toggle('hidden')">
            <span class="text-xs font-black uppercase tracking-wider text-black">📊 ${c.estudante_nome} - ${c.turma_nome} (Bimestre ${c.bimestre})</span>
            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-600"></i>
          </div>
          <div id="hm-${c.id}" class="p-4 hidden">
            <p class="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-wider">Data de Lançamento: <span class="text-black">${dForm}</span></p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-black uppercase border-b-2 border-black pb-1 mb-2">Desempenho</p>
                <p class="text-[10px] font-bold text-gray-600">${habsHtml}</p>
              </div>
              <div>
                <p class="text-xs font-black uppercase border-b-2 border-black pb-1 mb-2">Situação</p>
                <p class="text-[10px] font-bold text-gray-600 mb-1">Parecer: <span class="text-black">${c.parecer_evolutivo}</span></p>
                ${c.observacao_geral ? `<p class="text-[10px] italic border-l-2 border-gray-300 pl-2 mt-2">Obs: ${c.observacao_geral}</p>` : ''}
              </div>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>`;
  }

  function attachEvents() {
    const cn = container;
    cn.querySelector('#tab-diario')?.addEventListener('click', () => { activeTab = 'diario'; renderPage(); loadTabData(); });
    cn.querySelector('#tab-mensal')?.addEventListener('click', () => { activeTab = 'mensal'; renderPage(); loadTabData(); });
    
    cn.querySelector('#hist-turma')?.addEventListener('change', (e) => { 
      turmaSelecionada = e.target.value; 
      loadTabData(); 
    });
  }

  function loadingHTML() {
    return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
      <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">📜 Histórico de Registros</h2>
      <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
    </div><div class="h-40 skeleton rounded"></div></div>`;
  }
}
