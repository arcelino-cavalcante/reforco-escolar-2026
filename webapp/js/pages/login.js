/**
 * 🔐 TELA DE LOGIN
 * Perfis: Reforço, Regente, Coordenação e Admin.
 */

export function renderLogin(container, {
  onLogin,
  listarEscolas,
  listarProfsReforco,
  listarProfsRegentes,
  listarCoordenadores,
  autenticarCoordenador,
  setEscolaContext,
  isFirebaseConfigured
}) {
  let selectedProfile = null;
  let escolas = [];
  let selectedEscolaId = '';
  let selectedEscolaNome = '';

  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-start bg-[#f4f4f5] p-4 overflow-y-auto">
      <div class="w-full max-w-md mx-auto pt-8 md:pt-16 animate-fade-in">

        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-black border-4 border-black mb-4 shadow-[6px_6px_0px_0px_rgba(59,130,246,1)]">
            <span class="text-4xl">📚</span>
          </div>
          <h1 class="text-3xl font-black uppercase tracking-tight leading-tight">Reforço Escolar</h1>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Portal Pedagógico</p>
        </div>

        ${!isFirebaseConfigured() ? `
          <div class="bg-yellow-50 border-2 border-black p-3 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p class="font-bold text-xs text-yellow-800 flex items-center gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 flex-shrink-0"></i>
              Firebase não configurado — Usando dados demo.
            </p>
            <p class="text-[10px] text-yellow-700 mt-1">Edite <code class="bg-yellow-100 px-1 font-mono text-[10px]">js/firebase-config.js</code></p>
          </div>
        ` : ''}

        <div class="bg-white border-2 border-black p-4 mb-5 shadow-[6px_6px_0px_0px_rgba(16,185,129,1)]">
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">1. Selecione a Escola</p>
          <select id="login-escola-select" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">Carregando escolas...</option>
          </select>
          <p id="login-escola-msg" class="text-[10px] font-bold text-red-600 mt-2 hidden">Selecione uma escola para continuar.</p>
        </div>

        <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">Selecione seu perfil</p>

        <div class="space-y-3" id="login-profiles">

          <div class="profile-card bg-white border-2 border-black p-4 cursor-pointer transition-all hover:shadow-[8px_8px_0px_0px_rgba(59,130,246,1)] shadow-[6px_6px_0px_0px_rgba(59,130,246,1)]"
               data-profile="reforco" id="card-reforco">
            <div class="flex items-center gap-4" onclick="window.__selectProfile('reforco')">
              <div class="w-12 h-12 bg-blue-100 border-2 border-black flex items-center justify-center text-xl flex-shrink-0">👨‍🏫</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-black text-sm uppercase tracking-wider">Prof. de Reforço</h3>
                <p class="text-[10px] text-gray-500 font-bold mt-0.5">Registro diário, mensal e histórico</p>
              </div>
              <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200" id="arrow-reforco"></i>
            </div>
            <div class="hidden mt-4 pt-3 border-t-2 border-black animate-fade-in" id="expand-reforco">
              <div id="loading-reforco" class="hidden">
                <div class="h-10 skeleton rounded mb-3"></div>
                <div class="h-10 skeleton rounded"></div>
              </div>
              <div id="select-reforco" class="hidden space-y-3">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Selecione sua identificação:</label>
                  <select id="prof-reforco-select" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Carregando...</option>
                  </select>
                </div>
                <button onclick="window.__confirmLogin('reforco', event)" class="w-full bg-blue-600 border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <i data-lucide="log-in" class="w-4 h-4"></i>
                  Entrar no Sistema
                </button>
              </div>
            </div>
          </div>

          <div class="profile-card bg-white border-2 border-black p-4 cursor-pointer transition-all hover:shadow-[8px_8px_0px_0px_rgba(147,51,234,1)] shadow-[6px_6px_0px_0px_rgba(147,51,234,1)]"
               data-profile="regente" id="card-regente">
            <div class="flex items-center gap-4" onclick="window.__selectProfile('regente')">
              <div class="w-12 h-12 bg-purple-100 border-2 border-black flex items-center justify-center text-xl flex-shrink-0">👩‍🏫</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-black text-sm uppercase tracking-wider">Prof. Regente</h3>
                <p class="text-[10px] text-gray-500 font-bold mt-0.5">Painel da turma e evolução</p>
              </div>
              <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200" id="arrow-regente"></i>
            </div>
            <div class="hidden mt-4 pt-3 border-t-2 border-black animate-fade-in" id="expand-regente">
              <div id="loading-regente" class="hidden">
                <div class="h-10 skeleton rounded mb-3"></div>
                <div class="h-10 skeleton rounded"></div>
              </div>
              <div id="select-regente" class="hidden space-y-3">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Selecione sua identificação:</label>
                  <select id="prof-regente-select" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="">Carregando...</option>
                  </select>
                </div>
                <button onclick="window.__confirmLogin('regente', event)" class="w-full bg-purple-600 border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                  <i data-lucide="log-in" class="w-4 h-4"></i>
                  Entrar no Sistema
                </button>
              </div>
            </div>
          </div>

          <div class="profile-card bg-white border-2 border-black p-4 cursor-pointer transition-all hover:shadow-[8px_8px_0px_0px_rgba(234,179,8,1)] shadow-[6px_6px_0px_0px_rgba(234,179,8,1)]"
               data-profile="coordenacao" id="card-coordenacao">
            <div class="flex items-center gap-4" onclick="window.__selectProfile('coordenacao')">
              <div class="w-12 h-12 bg-yellow-100 border-2 border-black flex items-center justify-center text-xl flex-shrink-0">📋</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-black text-sm uppercase tracking-wider">Coordenação</h3>
                <p class="text-[10px] text-gray-500 font-bold mt-0.5">Gestão completa da escola</p>
              </div>
              <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200" id="arrow-coordenacao"></i>
            </div>
            <div class="hidden mt-4 pt-3 border-t-2 border-black animate-fade-in" id="expand-coordenacao">
              <div id="loading-coordenacao" class="hidden">
                <div class="h-10 skeleton rounded mb-3"></div>
                <div class="h-10 skeleton rounded"></div>
              </div>
              <div id="select-coordenacao" class="hidden space-y-3">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Coordenador:</label>
                  <select id="coord-select" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none">
                    <option value="">Carregando...</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">🔐 Senha:</label>
                  <input type="password" id="coord-password" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none" placeholder="Digite a senha do coordenador">
                </div>
                <div id="coord-error" class="hidden bg-red-50 border-2 border-black p-2 text-red-600 text-xs font-bold flex items-center gap-2">
                  <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
                  Credenciais inválidas.
                </div>
                <button onclick="window.__confirmLogin('coordenacao', event)" class="w-full bg-yellow-400 border-2 border-black text-black px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2">
                  <i data-lucide="lock" class="w-4 h-4"></i>
                  Entrar como Coordenação
                </button>
              </div>
            </div>
          </div>

          <div class="profile-card bg-white border-2 border-black p-4 cursor-pointer transition-all hover:shadow-[8px_8px_0px_0px_rgba(16,185,129,1)] shadow-[6px_6px_0px_0px_rgba(16,185,129,1)]"
               data-profile="admin" id="card-admin">
            <div class="flex items-center gap-4" onclick="window.__selectProfile('admin')">
              <div class="w-12 h-12 bg-emerald-100 border-2 border-black flex items-center justify-center text-xl flex-shrink-0">🛡️</div>
              <div class="flex-1 min-w-0">
                <h3 class="font-black text-sm uppercase tracking-wider">Admin do Sistema</h3>
                <p class="text-[10px] text-gray-500 font-bold mt-0.5">Escolas e coordenadores</p>
              </div>
              <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200" id="arrow-admin"></i>
            </div>
            <div class="hidden mt-4 pt-3 border-t-2 border-black animate-fade-in" id="expand-admin">
              <div class="space-y-3">
                <div>
                  <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Senha Admin:</label>
                  <input type="password" id="admin-password" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Digite: Admin123">
                </div>
                <div id="admin-error" class="hidden bg-red-50 border-2 border-black p-2 text-red-600 text-xs font-bold flex items-center gap-2">
                  <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
                  Senha admin inválida.
                </div>
                <button onclick="window.__confirmLogin('admin', event)" class="w-full bg-emerald-600 border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                  <i data-lucide="shield-check" class="w-4 h-4"></i>
                  Entrar no Admin
                </button>
              </div>
            </div>
          </div>

        </div>

        <p class="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-8 pb-8">
          Sistema de Reforço Escolar © 2026
        </p>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  hydrateEscolas();

  document.getElementById('login-escola-select')?.addEventListener('change', (e) => {
    selectedEscolaId = String(e?.target?.value || '').trim();
    const escola = escolas.find((x) => String(x.id) === selectedEscolaId);
    selectedEscolaNome = escola?.nome || '';
    if (selectedEscolaId) {
      setEscolaContext(selectedEscolaId, selectedEscolaNome);
      hideEscolaMsg();
      collapseAll();
      selectedProfile = null;
    }
  });

  window.__selectProfile = async (profile) => {
    if (profile !== 'admin' && !selectedEscolaId) {
      showEscolaMsg();
      return;
    }

    if (selectedProfile === profile) {
      collapseAll();
      selectedProfile = null;
      return;
    }

    collapseAll();
    selectedProfile = profile;

    const expandEl = document.getElementById('expand-' + profile);
    const arrowEl = document.getElementById('arrow-' + profile);
    if (expandEl) expandEl.classList.remove('hidden');
    if (arrowEl) arrowEl.style.transform = 'rotate(90deg)';

    if (profile === 'reforco') {
      await loadProfessors('reforco', listarProfsReforco, 'prof-reforco-select');
    } else if (profile === 'regente') {
      await loadProfessors('regente', listarProfsRegentes, 'prof-regente-select');
    } else if (profile === 'coordenacao') {
      await loadCoordenadores();
      setTimeout(() => document.getElementById('coord-password')?.focus(), 100);
    } else if (profile === 'admin') {
      setTimeout(() => document.getElementById('admin-password')?.focus(), 100);
    }

    if (window.lucide) lucide.createIcons();
  };

  window.__confirmLogin = async (profile, event) => {
    event.stopPropagation();

    if (profile !== 'admin' && !selectedEscolaId) {
      showEscolaMsg();
      return;
    }

    if (profile === 'reforco') {
      const select = document.getElementById('prof-reforco-select');
      const profId = String(select?.value || '').trim();
      if (!profId) return;
      const opt = select.options[select.selectedIndex];
      const profNome = opt?.text.split(' (')[0];
      const profArea = opt?.dataset?.area || '';
      const turmasIds = JSON.parse(opt?.dataset?.turmas || '[]');
      onLogin('reforco', profId, profNome, profArea, turmasIds, selectedEscolaId, selectedEscolaNome);
      return;
    }

    if (profile === 'regente') {
      const select = document.getElementById('prof-regente-select');
      const profId = String(select?.value || '').trim();
      if (!profId) return;
      const opt = select.options[select.selectedIndex];
      const profNome = opt?.text.split(' (')[0];
      const profArea = opt?.dataset?.area || '';
      const turmasIds = JSON.parse(opt?.dataset?.turmas || '[]');
      onLogin('regente', profId, profNome, profArea, turmasIds, selectedEscolaId, selectedEscolaNome);
      return;
    }

    if (profile === 'coordenacao') {
      const coordId = String(document.getElementById('coord-select')?.value || '').trim();
      const senha = String(document.getElementById('coord-password')?.value || '');
      if (!coordId || !senha) return;
      try {
        const coordenador = await autenticarCoordenador(selectedEscolaId, coordId, senha);
        if (coordenador) {
          onLogin(
            'coordenacao',
            coordenador.id,
            coordenador.nome || 'Coordenação',
            '',
            [],
            selectedEscolaId,
            selectedEscolaNome
          );
          return;
        }
      } catch (err) {
        // noop
      }
      const errEl = document.getElementById('coord-error');
      if (errEl) {
        errEl.classList.remove('hidden');
        setTimeout(() => errEl?.classList.add('hidden'), 3000);
      }
      return;
    }

    if (profile === 'admin') {
      const senha = String(document.getElementById('admin-password')?.value || '');
      if (senha === 'Admin123') {
        onLogin('admin', 'admin_root', 'Administrador', '', [], '', '');
      } else {
        const errEl = document.getElementById('admin-error');
        if (errEl) {
          errEl.classList.remove('hidden');
          setTimeout(() => errEl?.classList.add('hidden'), 3000);
        }
      }
    }
  };

  document.getElementById('coord-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.__confirmLogin('coordenacao', e);
    }
  });

  document.getElementById('admin-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.__confirmLogin('admin', e);
    }
  });

  function collapseAll() {
    ['reforco', 'regente', 'coordenacao', 'admin'].forEach((p) => {
      const exp = document.getElementById('expand-' + p);
      const arr = document.getElementById('arrow-' + p);
      if (exp) exp.classList.add('hidden');
      if (arr) arr.style.transform = '';
    });
  }

  async function hydrateEscolas() {
    const select = document.getElementById('login-escola-select');
    if (!select) return;
    try {
      escolas = await listarEscolas();
      if (!Array.isArray(escolas) || escolas.length === 0) {
        select.innerHTML = '<option value="">Nenhuma escola cadastrada</option>';
        return;
      }
      select.innerHTML = escolas.map((e) => `<option value="${e.id}">${e.nome}</option>`).join('');
      const padrao = escolas.find((e) => e.is_default === true) || escolas[0];
      if (padrao?.id) select.value = String(padrao.id);
      selectedEscolaId = String(select.value || padrao?.id || '');
      const esc = escolas.find((x) => String(x.id) === selectedEscolaId) || padrao || escolas[0];
      selectedEscolaNome = esc?.nome || '';
      if (selectedEscolaId) {
        setEscolaContext(selectedEscolaId, selectedEscolaNome);
        hideEscolaMsg();
      }
    } catch (err) {
      console.error('Erro ao carregar escolas:', err);
      select.innerHTML = '<option value="">Erro ao carregar escolas</option>';
    }
  }

  async function loadCoordenadores() {
    const loadingEl = document.getElementById('loading-coordenacao');
    const selectEl = document.getElementById('select-coordenacao');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (selectEl) selectEl.classList.add('hidden');

    try {
      const coords = await listarCoordenadores(selectedEscolaId);
      const sel = document.getElementById('coord-select');
      if (sel) {
        if (!coords || coords.length === 0) {
          sel.innerHTML = '<option value="">Nenhum coordenador cadastrado</option>';
        } else {
          sel.innerHTML = coords.map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
        }
      }
    } catch (err) {
      const sel = document.getElementById('coord-select');
      if (sel) sel.innerHTML = '<option value="">Erro ao carregar coordenadores</option>';
    }

    if (loadingEl) loadingEl.classList.add('hidden');
    if (selectEl) selectEl.classList.remove('hidden');
  }

  async function loadProfessors(profile, fetchFn, selectId) {
    const loadingEl = document.getElementById('loading-' + profile);
    const selectEl = document.getElementById('select-' + profile);
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (selectEl) selectEl.classList.add('hidden');

    try {
      const profs = await fetchFn();
      const selectInput = document.getElementById(selectId);
      if (selectInput) {
        if (profs.length === 0) {
          selectInput.innerHTML = '<option value="">Nenhum professor cadastrado</option>';
        } else {
          selectInput.innerHTML = profs.map((p) =>
            `<option value="${p.id}" data-area="${p.area || ''}" data-turmas='${JSON.stringify(p.turmas_ids || [])}'>${p.nome} (${p.area || 'Geral'})</option>`
          ).join('');
        }
      }
    } catch (err) {
      console.error('Erro ao carregar professores:', err);
      const selectInput = document.getElementById(selectId);
      if (selectInput) selectInput.innerHTML = '<option value="">Erro ao carregar</option>';
    }

    if (loadingEl) loadingEl.classList.add('hidden');
    if (selectEl) selectEl.classList.remove('hidden');
  }

  function showEscolaMsg() {
    const msg = document.getElementById('login-escola-msg');
    if (msg) msg.classList.remove('hidden');
  }

  function hideEscolaMsg() {
    const msg = document.getElementById('login-escola-msg');
    if (msg) msg.classList.add('hidden');
  }
}
