/**
 * ⚙️ CADASTROS — CRUD completo de Turmas, Estudantes e Professores
 * Replica toda a lógica do cadastros.py do Streamlit
 */

import {
  listarEscolas, criarEscola, getEscolaContext,
  listarEtapas, listarTurmas, criarTurma, atualizarTurma, excluirTurma,
  listarEstudantes, criarEstudante, atualizarEstudante, excluirEstudante,
  listarProfsReforco, criarProfReforco, atualizarProfReforco, excluirProfReforco,
  listarProfsRegentes, criarProfRegente, atualizarProfRegente, excluirProfRegente,
} from '../db.js';

// =====================================================
// TOAST NOTIFICATION
// =====================================================
function showToast(msg, type = 'success') {
  const old = document.getElementById('toast-cad');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toast-cad';
  const colors = { success: 'bg-green-100 text-green-800 border-green-600', error: 'bg-red-100 text-red-800 border-red-600', info: 'bg-blue-100 text-blue-800 border-blue-600' };
  t.className = `fixed top-4 right-4 z-[100] border-2 border-black p-3 font-bold text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] toast-enter max-w-xs ${colors[type] || colors.info}`;
  const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
  t.innerHTML = `<p class="flex items-center gap-2"><i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 flex-shrink-0"></i><span>${msg}</span></p>`;
  document.body.appendChild(t);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => t.remove(), 3500);
}

// =====================================================
// MAIN RENDER
// =====================================================
export async function renderCadastros(container, session) {
  // ---- state ----
  const isAdminView = session?.perfil === 'admin';
  let activeTab = isAdminView ? 'escolas' : 'turmas';
  let escolas = [];
  let etapas = [], turmas = [], estudantes = [];
  let profsReforco = [], profsRegentes = [];
  let editingId = null;
  let confirmDeleteId = null;
  let filtroTurmaEst = '';
  let filtroTipoProf = 'Todos';
  let saving = false;

  // show loading
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="border-b-4 border-black pb-4 mb-6">
        <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Cadastros</h2>
        <p class="text-gray-500 font-bold text-sm mt-1">Carregando dados...</p>
      </div>
      <div class="space-y-3">
        <div class="h-12 skeleton rounded"></div>
        <div class="h-40 skeleton rounded"></div>
        <div class="h-20 skeleton rounded"></div>
      </div>
    </div>`;

  // load data
  await loadAll();
  render();

  // ====================
  // DATA
  // ====================
  async function loadAll() {
    try {
      [escolas, etapas, turmas, estudantes, profsReforco, profsRegentes] = await Promise.all([
        listarEscolas(),
        listarEtapas(), listarTurmas(), listarEstudantes(null, true),
        listarProfsReforco(), listarProfsRegentes()
      ]);
    } catch (e) { console.error('Erro loadAll:', e); showToast('Erro ao carregar dados', 'error'); }
  }

  async function reloadEscolas() { escolas = await listarEscolas(); }
  async function reloadTurmas() { turmas = await listarTurmas(); }
  async function reloadEstudantes() { estudantes = await listarEstudantes(null, true); }
  async function reloadProfsReforco() { profsReforco = await listarProfsReforco(); }
  async function reloadProfsRegentes() { profsRegentes = await listarProfsRegentes(); }

  // ====================
  // RENDER
  // ====================
  function render() {
    editingId = null;
    confirmDeleteId = null;
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Cadastros</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Gerencie escolas, turmas, estudantes e professores</p>
        </div>
        ${renderTabs()}
        <div id="cad-content" class="page-enter">${renderContent()}</div>
      </div>`;
    attachEvents();
    icons();
  }

  function renderContentOnly() {
    editingId = null;
    confirmDeleteId = null;
    const el = document.getElementById('cad-content');
    if (!el) return;
    el.innerHTML = renderContent();
    el.className = 'page-enter';
    attachEvents();
    icons();
  }

  function icons() { if (window.lucide) lucide.createIcons(); }

  // ====================
  // TABS
  // ====================
  function renderTabs() {
    const tabs = [
      { id: 'turmas', icon: 'school', label: 'Turmas', count: turmas.length },
      { id: 'estudantes', icon: 'graduation-cap', label: 'Estudantes', count: estudantes.filter(e => e.ativo === 1 || e.ativo === undefined).length },
      { id: 'professores', icon: 'briefcase', label: 'Professores', count: profsReforco.length + profsRegentes.length },
    ];
    if (isAdminView) {
      tabs.unshift({ id: 'escolas', icon: 'building-2', label: 'Escolas', count: escolas.length });
    }
    return `<div class="flex border-2 border-black mb-6 overflow-hidden">
      ${tabs.map((t, i) => `<button data-action="tab" data-tab="${t.id}"
        class="flex-1 py-2.5 text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all
        ${activeTab === t.id ? 'bg-black text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}
        ${i > 0 ? 'border-l-2 border-black' : ''}">
        <i data-lucide="${t.icon}" class="w-4 h-4"></i>${t.label}
        <span class="text-[9px] bg-white/20 px-1.5 py-0.5 rounded ${activeTab === t.id ? 'text-yellow-300' : 'text-gray-400'}">${t.count}</span>
      </button>`).join('')}
    </div>`;
  }

  function renderContent() {
    if (activeTab === 'escolas') return renderEscolasTab();
    if (activeTab === 'turmas') return renderTurmasTab();
    if (activeTab === 'estudantes') return renderEstudantesTab();
    if (activeTab === 'professores') return renderProfessoresTab();
    return '';
  }

  // ======================================================
  //  ESCOLAS TAB
  // ======================================================
  function renderEscolasTab() {
    const ctx = getEscolaContext();
    const currentId = String(ctx?.escolaId || session?.escolaId || '');
    const currentNome = String(ctx?.escolaNome || session?.escolaNome || '');

    return `
      <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(245,158,11,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4 text-amber-600"></i> Nova Escola
        </h3>
        <form id="form-escola" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome da Escola *</label>
            <input type="text" id="inp-escola-nome" required placeholder="Ex: Escola Municipal Maria José"
              class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500">
          </div>
          <div class="flex items-end">
            <button type="submit" id="btn-add-escola" class="w-full bg-black border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Cadastrar
            </button>
          </div>
        </form>
      </div>

      <div class="bg-amber-50 border-2 border-black p-3 mb-4">
        <p class="text-[10px] font-black uppercase tracking-wider text-amber-800">Escola ativa nesta sessão</p>
        <p class="text-sm font-black mt-1">${esc(currentNome || 'Não definida')}</p>
        <p class="text-[10px] font-bold text-amber-700 mt-1">Para trocar de escola, use o login e selecione outra unidade.</p>
      </div>

      <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
        <h3 class="text-xs font-black uppercase tracking-wider">Escolas Cadastradas</h3>
        <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">${escolas.length} escolas</span>
      </div>
      <div class="space-y-2">
        ${escolas.length === 0 ? emptyMsg('Nenhuma escola cadastrada') : escolas.map((e) => {
          const ativa = currentId && currentId === String(e.id);
          return `
            <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-amber-100 border-2 border-black flex items-center justify-center flex-shrink-0">
                  <i data-lucide="building-2" class="w-4 h-4 text-amber-700"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-black text-sm truncate">${esc(e.nome || '')}</p>
                  <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${e.is_default ? 'Escola padrão do sistema' : 'Escola adicional'}</p>
                </div>
                ${ativa ? '<span class="text-[9px] font-black uppercase tracking-wider px-2 py-1 border border-black bg-emerald-100 text-emerald-800">Ativa</span>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ======================================================
  //  TURMAS TAB
  // ======================================================
  function renderTurmasTab() {
    return `
      <!-- FORM NOVA TURMA -->
      <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(59,130,246,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4 text-blue-600"></i> Nova Turma
        </h3>
        <form id="form-turma" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome *</label>
            <input type="text" id="inp-turma-nome" required placeholder="Ex: 5º Ano A"
              class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Etapa *</label>
            <select id="inp-turma-etapa" required class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione...</option>
              ${etapas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button type="submit" id="btn-add-turma" class="w-full bg-black border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Cadastrar
            </button>
          </div>
        </form>
      </div>

      <!-- LISTA -->
      <div class="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
        <h3 class="text-xs font-black uppercase tracking-wider">Turmas Cadastradas</h3>
        <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">${turmas.length} turmas</span>
      </div>
      <div class="space-y-2" id="list-turmas">
        ${turmas.length === 0 ? emptyMsg('Nenhuma turma cadastrada ainda') :
        turmas.map(t => cardTurma(t)).join('')}
      </div>`;
  }

  function cardTurma(t) {
    const editing = editingId === 'turma_' + t.id;
    const deleting = confirmDeleteId === 'turma_' + t.id;
    return `
      <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-100 border-2 border-black flex items-center justify-center flex-shrink-0">
            <i data-lucide="school" class="w-4 h-4 text-blue-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-black text-sm truncate">${esc(t.nome)}</p>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${esc(t.etapa_nome || '—')}</p>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button data-action="edit-turma" data-id="${t.id}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-blue-50 transition-colors" title="Editar">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button data-action="ask-del-turma" data-id="${t.id}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-red-50 transition-colors" title="Excluir">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
            </button>
          </div>
        </div>
        ${deleting ? deleteConfirm('turma', t.id, `"${esc(t.nome)}" e todos seus estudantes`) : ''}
        ${editing ? editFormTurma(t) : ''}
      </div>`;
  }

  function editFormTurma(t) {
    return `<div class="mt-3 pt-3 border-t-2 border-dashed border-gray-300 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome</label>
          <input type="text" id="edit-turma-nome" value="${esc(t.nome)}" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Etapa</label>
          <select id="edit-turma-etapa" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500">
            ${etapas.map(e => `<option value="${e.id}" ${e.id === t.etapa_id ? 'selected' : ''}>${e.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button data-action="save-turma" data-id="${t.id}" class="flex-1 bg-blue-600 border-2 border-black text-white px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Salvar
        </button>
        <button data-action="cancel" class="flex-1 bg-gray-100 border-2 border-black text-black px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
      </div>
    </div>`;
  }

  // ======================================================
  //  ESTUDANTES TAB
  // ======================================================
  function renderEstudantesTab() {
    const ativos = estudantes.filter(e => e.ativo === 1 || e.ativo === undefined);
    const filtered = filtroTurmaEst ? ativos.filter(e => e.turma_id === filtroTurmaEst) : ativos;

    return `
      <!-- FORM NOVO ESTUDANTE -->
      <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(16,185,129,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4 text-green-600"></i> Novo Estudante
        </h3>
        ${turmas.length === 0 ? `<p class="text-xs font-bold text-red-600 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Cadastre pelo menos uma turma primeiro!</p>` : `
        <form id="form-estudante" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome do Estudante *</label>
            <input type="text" id="inp-est-nome" required placeholder="Nome completo"
              class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma *</label>
            <select id="inp-est-turma" required class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500">
              <option value="">Selecione...</option>
              ${turmas.map(t => `<option value="${t.id}">${t.nome} (${t.etapa_nome})</option>`).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <button type="submit" id="btn-add-est" class="w-full bg-black border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <i data-lucide="plus" class="w-4 h-4"></i> Cadastrar
            </button>
          </div>
        </form>`}
      </div>

      <!-- FILTRO + LISTA -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-black pb-2 mb-4">
        <h3 class="text-xs font-black uppercase tracking-wider">Estudantes Cadastrados</h3>
        <div class="flex items-center gap-2">
          <select id="filtro-turma-est" class="border-2 border-black px-2 py-1 bg-gray-50 font-bold text-xs outline-none">
            <option value="">Todas as Turmas</option>
            ${turmas.map(t => `<option value="${t.id}" ${filtroTurmaEst === t.id ? 'selected' : ''}>${t.nome}</option>`).join('')}
          </select>
          <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">${filtered.length} alunos</span>
        </div>
      </div>
      <div class="space-y-2" id="list-estudantes">
        ${filtered.length === 0 ? emptyMsg('Nenhum estudante encontrado') :
        filtered.map(e => cardEstudante(e)).join('')}
      </div>`;
  }

  function cardEstudante(e) {
    const editing = editingId === 'est_' + e.id;
    const deleting = confirmDeleteId === 'est_' + e.id;
    return `
      <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-green-100 border-2 border-black flex items-center justify-center flex-shrink-0">
            <i data-lucide="user" class="w-4 h-4 text-green-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-black text-sm truncate">${esc(e.nome)}</p>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${esc(e.turma_nome || '—')} · ${esc(e.etapa_nome || '')}</p>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button data-action="edit-est" data-id="${e.id}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-blue-50 transition-colors" title="Editar">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button data-action="ask-del-est" data-id="${e.id}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-red-50 transition-colors" title="Excluir">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
            </button>
          </div>
        </div>
        ${deleting ? deleteConfirm('est', e.id, `"${esc(e.nome)}"`) : ''}
        ${editing ? editFormEstudante(e) : ''}
      </div>`;
  }

  function editFormEstudante(e) {
    return `<div class="mt-3 pt-3 border-t-2 border-dashed border-gray-300 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome</label>
          <input type="text" id="edit-est-nome" value="${esc(e.nome)}" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turma</label>
          <select id="edit-est-turma" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-green-500">
            ${turmas.map(t => `<option value="${t.id}" ${t.id === e.turma_id ? 'selected' : ''}>${t.nome} (${t.etapa_nome})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button data-action="save-est" data-id="${e.id}" class="flex-1 bg-green-600 border-2 border-black text-white px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Salvar
        </button>
        <button data-action="cancel" class="flex-1 bg-gray-100 border-2 border-black text-black px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
      </div>
    </div>`;
  }

  // ======================================================
  //  PROFESSORES TAB
  // ======================================================
  function renderProfessoresTab() {
    const allProfs = [
      ...profsReforco.map(p => ({ ...p, tipo: 'Reforço', _collection: 'reforco' })),
      ...profsRegentes.map(p => ({ ...p, tipo: 'Regente', _collection: 'regente' })),
    ].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const filtered = filtroTipoProf === 'Todos' ? allProfs :
      filtroTipoProf === 'Reforço' ? allProfs.filter(p => p._collection === 'reforco') :
        allProfs.filter(p => p._collection === 'regente');

    return `
      <!-- FORM NOVO PROFESSOR -->
      <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(147,51,234,1)] mb-6">
        <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
          <i data-lucide="plus-circle" class="w-4 h-4 text-purple-600"></i> Novo Professor
        </h3>
        <form id="form-prof" class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome *</label>
              <input type="text" id="inp-prof-nome" required placeholder="Nome completo"
                class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-500">
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Área *</label>
              <select id="inp-prof-area" required class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-500">
                <option value="">Selecione...</option>
                <option value="Português">Português</option>
                <option value="Matemática">Matemática</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Tipo *</label>
              <select id="inp-prof-tipo" required class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-500">
                <option value="">Selecione...</option>
                <option value="reforco">Professor de Reforço</option>
                <option value="regente">Professor Regente</option>
              </select>
            </div>
          </div>
          ${turmas.length > 0 ? `
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turmas Atribuídas *</label>
            <div class="border-2 border-black bg-gray-50 p-2 max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
              ${turmas.map(t => `
                <label class="flex items-center gap-2 cursor-pointer p-1 hover:bg-white transition-colors rounded text-xs font-bold">
                  <input type="checkbox" name="new-prof-turmas" value="${t.id}" class="w-3.5 h-3.5 accent-black">
                  ${esc(t.nome)} <span class="text-gray-400 text-[9px]">(${esc(t.etapa_nome)})</span>
                </label>`).join('')}
            </div>
          </div>` : `<p class="text-xs font-bold text-red-600 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Cadastre pelo menos uma turma primeiro!</p>`}
          <button type="submit" id="btn-add-prof" class="w-full bg-black border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(147,51,234,1)] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i> Cadastrar Professor
          </button>
        </form>
      </div>

      <!-- FILTRO + LISTA -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-black pb-2 mb-4">
        <h3 class="text-xs font-black uppercase tracking-wider">Equipe Cadastrada</h3>
        <div class="flex items-center gap-2">
          <select id="filtro-tipo-prof" class="border-2 border-black px-2 py-1 bg-gray-50 font-bold text-xs outline-none">
            <option value="Todos" ${filtroTipoProf === 'Todos' ? 'selected' : ''}>Todos</option>
            <option value="Reforço" ${filtroTipoProf === 'Reforço' ? 'selected' : ''}>Reforço</option>
            <option value="Regente" ${filtroTipoProf === 'Regente' ? 'selected' : ''}>Regente</option>
          </select>
          <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 border border-black">${filtered.length} profs</span>
        </div>
      </div>
      <div class="space-y-2" id="list-profs">
        ${filtered.length === 0 ? emptyMsg('Nenhum professor encontrado') :
        filtered.map(p => cardProf(p)).join('')}
      </div>`;
  }

  function cardProf(p) {
    const editing = editingId === 'prof_' + p._collection + '_' + p.id;
    const deleting = confirmDeleteId === 'prof_' + p._collection + '_' + p.id;
    const tipoColor = p._collection === 'reforco' ? 'blue' : 'purple';
    const turmasNomes = (p.turmas_ids || []).map(tid => {
      const t = turmas.find(tt => tt.id === tid);
      return t ? t.nome : '';
    }).filter(Boolean).join(', ');

    return `
      <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-${tipoColor}-100 border-2 border-black flex items-center justify-center flex-shrink-0">
            <i data-lucide="${p._collection === 'reforco' ? 'book-open' : 'users'}" class="w-4 h-4 text-${tipoColor}-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-black text-sm truncate">${esc(p.nome)}</p>
              <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-black ${p._collection === 'reforco' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}">${p.tipo}</span>
            </div>
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${esc(p.area || '—')} · ${turmasNomes || 'Sem turmas'}</p>
          </div>
          <div class="flex gap-1.5 flex-shrink-0">
            <button data-action="edit-prof" data-id="${p.id}" data-col="${p._collection}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-blue-50 transition-colors" title="Editar">
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button data-action="ask-del-prof" data-id="${p.id}" data-col="${p._collection}" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-red-50 transition-colors" title="Excluir">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 text-red-600"></i>
            </button>
          </div>
        </div>
        ${deleting ? deleteConfirm('prof', p.id, `"${esc(p.nome)}"`, p._collection) : ''}
        ${editing ? editFormProf(p) : ''}
      </div>`;
  }

  function editFormProf(p) {
    return `<div class="mt-3 pt-3 border-t-2 border-dashed border-gray-300 animate-fade-in">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome</label>
          <input type="text" id="edit-prof-nome" value="${esc(p.nome)}" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Área</label>
          <select id="edit-prof-area" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-purple-500">
            <option value="Português" ${p.area === 'Português' ? 'selected' : ''}>Português</option>
            <option value="Matemática" ${p.area === 'Matemática' ? 'selected' : ''}>Matemática</option>
          </select>
        </div>
      </div>
      <div class="mt-3">
        <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Turmas</label>
        <div class="border-2 border-black bg-gray-50 p-2 max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
          ${turmas.map(t => `
            <label class="flex items-center gap-2 cursor-pointer p-1 hover:bg-white transition-colors rounded text-xs font-bold">
              <input type="checkbox" name="edit-prof-turmas" value="${t.id}" ${(p.turmas_ids || []).includes(t.id) ? 'checked' : ''} class="w-3.5 h-3.5 accent-black">
              ${esc(t.nome)}
            </label>`).join('')}
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button data-action="save-prof" data-id="${p.id}" data-col="${p._collection}" class="flex-1 bg-purple-600 border-2 border-black text-white px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Salvar
        </button>
        <button data-action="cancel" class="flex-1 bg-gray-100 border-2 border-black text-black px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
      </div>
    </div>`;
  }

  // ======================================================
  //  SHARED COMPONENTS
  // ======================================================
  function deleteConfirm(type, id, label, col = '') {
    return `<div class="mt-3 pt-3 border-t-2 border-red-200 animate-fade-in bg-red-50 -mx-3 -mb-3 p-3 border-2 border-t-0 border-black">
      <p class="text-xs font-bold text-red-800 mb-2 flex items-center gap-1">
        <i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0"></i>
        Confirma exclusão de ${label}?
        ${type === 'turma' ? '<br><span class="text-[10px] text-red-600">⚠️ Estudantes desta turma serão removidos!</span>' : ''}
      </p>
      <div class="flex gap-2">
        <button data-action="do-del-${type}" data-id="${id}" data-col="${col}" class="flex-1 bg-red-600 border-2 border-black text-white px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1">
          <i data-lucide="trash-2" class="w-3 h-3"></i> Sim, Apagar
        </button>
        <button data-action="cancel" class="flex-1 bg-white border-2 border-black text-black px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Cancelar</button>
      </div>
    </div>`;
  }

  function emptyMsg(text) {
    return `<div class="text-center py-8 text-gray-400">
      <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
      <p class="text-xs font-bold uppercase tracking-wider">${text}</p>
    </div>`;
  }

  function esc(str) { return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ======================================================
  //  EVENT DELEGATION
  // ======================================================
  function attachEvents() {
    // Remove old listeners by cloning
    const fresh = container.cloneNode(true);
    container.parentNode.replaceChild(fresh, container);
    container = fresh;

    // Clicks
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const col = btn.dataset.col;
      const tab = btn.dataset.tab;

      switch (action) {
        case 'tab': activeTab = tab; renderContentOnly(); break;

        // TURMA
        case 'edit-turma': editingId = 'turma_' + id; confirmDeleteId = null; renderContentOnly(); break;
        case 'ask-del-turma': confirmDeleteId = 'turma_' + id; editingId = null; renderContentOnly(); break;
        case 'save-turma': await doSaveTurma(id); break;
        case 'do-del-turma': await doDeleteTurma(id); break;

        // ESTUDANTE
        case 'edit-est': editingId = 'est_' + id; confirmDeleteId = null; renderContentOnly(); break;
        case 'ask-del-est': confirmDeleteId = 'est_' + id; editingId = null; renderContentOnly(); break;
        case 'save-est': await doSaveEstudante(id); break;
        case 'do-del-est': await doDeleteEstudante(id); break;

        // PROFESSOR
        case 'edit-prof': editingId = 'prof_' + col + '_' + id; confirmDeleteId = null; renderContentOnly(); break;
        case 'ask-del-prof': confirmDeleteId = 'prof_' + col + '_' + id; editingId = null; renderContentOnly(); break;
        case 'save-prof': await doSaveProf(id, col); break;
        case 'do-del-prof': await doDeleteProf(id, col); break;

        // CANCEL
        case 'cancel': editingId = null; confirmDeleteId = null; renderContentOnly(); break;
      }
    });

    // Form submits
    container.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formId = e.target.id;
      if (formId === 'form-escola') await doCreateEscola();
      else if (formId === 'form-turma') await doCreateTurma();
      else if (formId === 'form-estudante') await doCreateEstudante();
      else if (formId === 'form-prof') await doCreateProf();
    });

    // Filtros (select change)
    const filtroEst = container.querySelector('#filtro-turma-est');
    if (filtroEst) {
      filtroEst.addEventListener('change', () => {
        filtroTurmaEst = filtroEst.value;
        renderContentOnly();
      });
    }
    const filtroProf = container.querySelector('#filtro-tipo-prof');
    if (filtroProf) {
      filtroProf.addEventListener('change', () => {
        filtroTipoProf = filtroProf.value;
        renderContentOnly();
      });
    }
  }

  // ======================================================
  //  ACTIONS — ESCOLA
  // ======================================================
  async function doCreateEscola() {
    const nome = container.querySelector('#inp-escola-nome')?.value?.trim();
    if (!nome) return showToast('Informe o nome da escola', 'error');
    setSaving(true);
    try {
      await criarEscola(nome);
      await reloadEscolas();
      showToast(`Escola "${nome}" cadastrada!`, 'success');
      renderContentOnly();
    } catch (err) {
      showToast('Erro ao cadastrar escola: ' + err.message, 'error');
    }
    setSaving(false);
  }

  // ======================================================
  //  ACTIONS — TURMA
  // ======================================================
  async function doCreateTurma() {
    const nome = container.querySelector('#inp-turma-nome')?.value?.trim();
    const etapaId = container.querySelector('#inp-turma-etapa')?.value;
    if (!nome || !etapaId) return showToast('Preencha todos os campos', 'error');
    setSaving(true);
    try {
      await criarTurma(nome, etapaId);
      await reloadTurmas();
      showToast(`Turma "${nome}" cadastrada!`);
      renderContentOnly();
    } catch (err) { showToast('Erro ao cadastrar: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doSaveTurma(id) {
    const nome = container.querySelector('#edit-turma-nome')?.value?.trim();
    const etapaId = container.querySelector('#edit-turma-etapa')?.value;
    if (!nome) return showToast('Nome obrigatório', 'error');
    setSaving(true);
    try {
      await atualizarTurma(id, nome, etapaId);
      await reloadTurmas();
      showToast(`Turma atualizada!`);
      editingId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doDeleteTurma(id) {
    setSaving(true);
    try {
      await excluirTurma(id);
      await Promise.all([reloadTurmas(), reloadEstudantes()]);
      showToast(`Turma excluída!`);
      confirmDeleteId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  // ======================================================
  //  ACTIONS — ESTUDANTE
  // ======================================================
  async function doCreateEstudante() {
    const nome = container.querySelector('#inp-est-nome')?.value?.trim();
    const turmaId = container.querySelector('#inp-est-turma')?.value;
    if (!nome || !turmaId) return showToast('Preencha todos os campos', 'error');
    setSaving(true);
    try {
      await criarEstudante(nome, turmaId);
      await reloadEstudantes();
      showToast(`Estudante "${nome}" cadastrado!`);
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doSaveEstudante(id) {
    const nome = container.querySelector('#edit-est-nome')?.value?.trim();
    const turmaId = container.querySelector('#edit-est-turma')?.value;
    if (!nome) return showToast('Nome obrigatório', 'error');
    setSaving(true);
    try {
      await atualizarEstudante(id, nome, turmaId);
      await reloadEstudantes();
      showToast(`Estudante atualizado!`);
      editingId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doDeleteEstudante(id) {
    setSaving(true);
    try {
      await excluirEstudante(id);
      await reloadEstudantes();
      showToast(`Estudante excluído!`);
      confirmDeleteId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  // ======================================================
  //  ACTIONS — PROFESSOR
  // ======================================================
  async function doCreateProf() {
    const nome = container.querySelector('#inp-prof-nome')?.value?.trim();
    const area = container.querySelector('#inp-prof-area')?.value;
    const tipo = container.querySelector('#inp-prof-tipo')?.value;
    const turmasIds = Array.from(container.querySelectorAll('input[name="new-prof-turmas"]:checked')).map(cb => cb.value);
    if (!nome || !area || !tipo) return showToast('Preencha todos os campos', 'error');
    if (turmasIds.length === 0) return showToast('Selecione pelo menos uma turma', 'error');
    setSaving(true);
    try {
      if (tipo === 'reforco') {
        await criarProfReforco(nome, area, turmasIds);
        await reloadProfsReforco();
      } else {
        await criarProfRegente(nome, area, turmasIds);
        await reloadProfsRegentes();
      }
      showToast(`Professor "${nome}" cadastrado!`);
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doSaveProf(id, col) {
    const nome = container.querySelector('#edit-prof-nome')?.value?.trim();
    const area = container.querySelector('#edit-prof-area')?.value;
    const turmasIds = Array.from(container.querySelectorAll('input[name="edit-prof-turmas"]:checked')).map(cb => cb.value);
    if (!nome) return showToast('Nome obrigatório', 'error');
    setSaving(true);
    try {
      if (col === 'reforco') {
        await atualizarProfReforco(id, nome, area, turmasIds);
        await reloadProfsReforco();
      } else {
        await atualizarProfRegente(id, nome, area, turmasIds);
        await reloadProfsRegentes();
      }
      showToast(`Professor atualizado!`);
      editingId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  async function doDeleteProf(id, col) {
    setSaving(true);
    try {
      if (col === 'reforco') {
        await excluirProfReforco(id);
        await reloadProfsReforco();
      } else {
        await excluirProfRegente(id);
        await reloadProfsRegentes();
      }
      showToast(`Professor excluído!`);
      confirmDeleteId = null;
      renderContentOnly();
    } catch (err) { showToast('Erro: ' + err.message, 'error'); }
    setSaving(false);
  }

  // ======================================================
  //  HELPERS
  // ======================================================
  function setSaving(val) {
    saving = val;
    container.querySelectorAll('button[type="submit"]').forEach(b => {
      b.disabled = val;
      if (val) b.classList.add('opacity-50', 'cursor-wait');
      else b.classList.remove('opacity-50', 'cursor-wait');
    });
  }
}
