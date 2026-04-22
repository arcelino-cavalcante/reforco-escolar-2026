/**
 * 🚀 MAIN.JS — Entry Point do App Reforço Escolar
 * Orquestra: Firebase, sessão, shell, roteamento e páginas.
 */

import { initFirebase, isFirebaseConfigured } from './firebase-config.js';
import { getSession, setSession, clearSession } from './auth.js';
import {
  listarProfsReforco,
  listarProfsRegentes,
  listarEscolas,
  listarCoordenadores,
  autenticarCoordenador,
  garantirEscolaPadrao,
  setEscolaContext
} from './db.js';

function lazyNamedRender(importer, exportName) {
  let renderFn = null;
  return async (...args) => {
    if (!renderFn) {
      const mod = await importer();
      renderFn = mod?.[exportName];
      if (typeof renderFn !== 'function') {
        throw new Error(`Render "${exportName}" não encontrado no módulo.`);
      }
    }
    return renderFn(...args);
  };
}

// === PAGES (lazy load / code-splitting) ===
const renderLogin = lazyNamedRender(() => import('./pages/login.js'), 'renderLogin');
const renderDashboard = lazyNamedRender(() => import('./pages/dashboard.js'), 'renderDashboard');
const renderRegistroDiario = lazyNamedRender(() => import('./pages/registro-diario.js'), 'renderRegistroDiario');
const renderRegistroMensal = lazyNamedRender(() => import('./pages/registro-mensal.js'), 'renderRegistroMensal');
const renderHistorico = lazyNamedRender(() => import('./pages/historico.js'), 'renderHistorico');
const renderPainelRegente = lazyNamedRender(() => import('./pages/painel-regente.js'), 'renderPainelRegente');
const renderRelatorioEvolucao = lazyNamedRender(() => import('./pages/relatorio-evolucao.js'), 'renderRelatorioEvolucao');
const renderCadastros = lazyNamedRender(() => import('./pages/cadastros.js'), 'renderCadastros');
const renderDossie = lazyNamedRender(() => import('./pages/dossie.js'), 'renderDossie');
const renderVerRegistros = lazyNamedRender(() => import('./pages/ver-registros.js'), 'renderVerRegistros');
const renderAnaliseEvolucaoHub = lazyNamedRender(() => import('./pages/analise-evolucao-hub.js'), 'renderAnaliseEvolucaoHub');
const renderIATutor = lazyNamedRender(() => import('./pages/ia-tutor.js'), 'renderIATutor');
const renderFechamentoBimestral = lazyNamedRender(() => import('./pages/fechamento-bimestral.js'), 'renderFechamentoBimestral');
const renderFluxoEncaminhamentos = lazyNamedRender(() => import('./pages/fluxo-encaminhamentos.js'), 'renderFluxoEncaminhamentos');
const renderAdmin = lazyNamedRender(() => import('./pages/admin.js'), 'renderAdmin');

const PAGE_PRELOADERS = {
  reforco: [
    { id: 'dashboard', load: () => import('./pages/dashboard.js') },
    { id: 'registro-diario', load: () => import('./pages/registro-diario.js') },
    { id: 'registro-mensal', load: () => import('./pages/registro-mensal.js') },
    { id: 'historico', load: () => import('./pages/historico.js') }
  ],
  regente: [
    { id: 'painel-regente', load: () => import('./pages/painel-regente.js') },
    { id: 'relatorio-evolucao', load: () => import('./pages/relatorio-evolucao.js') }
  ],
  coordenacao: [
    { id: 'dashboard', load: () => import('./pages/dashboard.js') },
    { id: 'analise-evolucao', load: () => import('./pages/analise-evolucao-hub.js') },
    { id: 'fechamento-bimestral', load: () => import('./pages/fechamento-bimestral.js') },
    { id: 'fluxo-encaminhamentos', load: () => import('./pages/fluxo-encaminhamentos.js') },
    { id: 'dossie', load: () => import('./pages/dossie.js') },
    { id: 'ver-registros', load: () => import('./pages/ver-registros.js') },
    { id: 'ia-tutor', load: () => import('./pages/ia-tutor.js') },
    { id: 'cadastros', load: () => import('./pages/cadastros.js') }
  ],
  admin: [
    { id: 'admin', load: () => import('./pages/admin.js') }
  ]
};

function preloadProfilePages(perfil, currentPageId) {
  const preloaders = PAGE_PRELOADERS[perfil] || [];
  if (preloaders.length === 0) return;

  const schedule = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback.bind(window)
    : (cb) => setTimeout(cb, 250);

  schedule(() => {
    preloaders.forEach((item) => {
      if (item.id === currentPageId) return;
      item.load().catch(() => {});
    });
  });
}

// =====================================================
// MENU CONFIG PER PROFILE
// =====================================================
const MENUS = {
  reforco: [
    { id: 'dashboard', label: 'Dashboard', short: 'Início', icon: 'layout-dashboard', render: renderDashboard },
    { id: 'registro-diario', label: 'Ficha Diária', short: 'Diário', icon: 'pencil-line', render: renderRegistroDiario },
    { id: 'registro-mensal', label: 'Registro Mensal', short: 'Bimestral', icon: 'calendar-check', render: renderRegistroMensal },
    { id: 'historico', label: 'Histórico', short: 'Histórico', icon: 'clock', render: renderHistorico },
  ],
  regente: [
    { id: 'painel-regente', label: 'Painel da Turma', short: 'Painel', icon: 'users', render: renderPainelRegente },
    { id: 'relatorio-evolucao', label: 'Relatório de Evolução', short: 'Evolução', icon: 'trending-up', render: renderRelatorioEvolucao },
  ],
  coordenacao: [
    { id: 'dashboard', label: 'Dashboard', short: 'Início', icon: 'layout-dashboard', render: renderDashboard },
    { id: 'analise-evolucao', label: 'Análises', short: 'Análises', icon: 'bar-chart-2', render: renderAnaliseEvolucaoHub },
    { id: 'fechamento-bimestral', label: 'Fechamento Bimestral', short: 'Fechamento', icon: 'clipboard-check', render: renderFechamentoBimestral },
    { id: 'fluxo-encaminhamentos', label: 'Fluxo de Encaminhamentos', short: 'Encaminh.', icon: 'git-pull-request-arrow', render: renderFluxoEncaminhamentos },
    { id: 'dossie', label: 'Dossiê do Estudante', short: 'Dossiê', icon: 'user-search', render: renderDossie },
    { id: 'ver-registros', label: 'Ver Registros', short: 'Registros', icon: 'table', render: renderVerRegistros },
    { id: 'ia-tutor', label: 'IA Tutor', short: 'IA Tutor', icon: 'bot', render: renderIATutor },
    { id: 'cadastros', label: 'Cadastros', short: 'Cadastros', icon: 'settings', render: renderCadastros },
  ],
  admin: [
    { id: 'admin', label: 'Admin Sistema', short: 'Admin', icon: 'shield-check', render: renderAdmin },
  ]
};

const PERFIL_CONFIG = {
  reforco:     { label: 'Prof. Reforço', icon: '👨‍🏫', color: 'blue' },
  regente:     { label: 'Prof. Regente', icon: '👩‍🏫', color: 'purple' },
  coordenacao: { label: 'Coordenação',   icon: '📋', color: 'yellow' },
  admin:       { label: 'Admin Sistema', icon: '🛡️', color: 'emerald' },
};

// =====================================================
// STATE
// =====================================================
let currentPage = null;
let session = null;
let appElement = null;
let navigationSeq = 0;

// =====================================================
// INIT
// =====================================================
async function initApp() {
  initFirebase();
  appElement = document.getElementById('app');
  session = getSession();

  let escolaPadrao = null;
  try {
    escolaPadrao = await garantirEscolaPadrao();
  } catch (err) {
    escolaPadrao = null;
  }

  if (session?.perfil === 'admin') {
    setEscolaContext('', '');
  } else if (session?.escolaId) {
    let escolaNome = session.escolaNome || '';
    if (!escolaNome) {
      try {
        const escolas = await listarEscolas();
        const found = escolas.find((e) => String(e.id) === String(session.escolaId));
        escolaNome = found?.nome || '';
      } catch (err) {
        escolaNome = '';
      }
      if (escolaNome) {
        session = setSession(
          session.perfil,
          session.profId,
          session.profNome,
          session.profArea || '',
          session.turmasIds || [],
          session.escolaId,
          escolaNome
        );
      }
    }
    setEscolaContext(session.escolaId, escolaNome);
  } else if (session && escolaPadrao?.id) {
    session = setSession(
      session.perfil,
      session.profId,
      session.profNome,
      session.profArea || '',
      session.turmasIds || [],
      escolaPadrao.id,
      escolaPadrao.nome || ''
    );
    setEscolaContext(escolaPadrao.id, escolaPadrao.nome || '');
  } else if (escolaPadrao?.id) {
    setEscolaContext(escolaPadrao.id, escolaPadrao.nome || '');
  }

  if (session) {
    showAppShell();
  } else {
    showLogin();
  }
}

// =====================================================
// LOGIN SCREEN
// =====================================================
function showLogin() {
  renderLogin(appElement, {
    onLogin: (perfil, profId, profNome, profArea, turmasIds, escolaId, escolaNome) => {
      setEscolaContext(escolaId, escolaNome);
      session = setSession(perfil, profId, profNome, profArea, turmasIds, escolaId, escolaNome);
      showAppShell();
    },
    listarEscolas,
    listarProfsReforco,
    listarProfsRegentes,
    listarCoordenadores,
    autenticarCoordenador,
    setEscolaContext,
    isFirebaseConfigured,
  });
}

// =====================================================
// APP SHELL (Sidebar + Content)
// =====================================================
function showAppShell() {
  const menus = MENUS[session.perfil] || [];
  const cfg = PERFIL_CONFIG[session.perfil];

  appElement.innerHTML = `
    <!-- MOBILE SIDEBAR OVERLAY -->
    <div id="sidebar-overlay" class="fixed inset-0 bg-black/60 z-40 hidden md:hidden transition-opacity" onclick="window.__toggleSidebar()"></div>

    <div class="flex h-full">

      <!-- ====== SIDEBAR ====== -->
      <aside id="sidebar" class="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r-4 border-black transform -translate-x-full md:relative md:translate-x-0 flex flex-col transition-transform duration-300 ease-in-out flex-shrink-0">

        <!-- Sidebar Header -->
        <div class="p-5 border-b-4 border-black bg-black text-white">
          <div class="flex justify-between items-center">
            <div>
              <h1 class="text-lg font-black uppercase tracking-wider text-yellow-400 leading-tight">📚 Reforço</h1>
              <p class="text-[10px] text-gray-400 mt-0.5 uppercase tracking-[0.2em] font-bold">Portal Pedagógico</p>
            </div>
            <button class="md:hidden text-white hover:text-yellow-400 transition-colors p-1" onclick="window.__toggleSidebar()">
              <i data-lucide="x" class="w-6 h-6"></i>
            </button>
          </div>
        </div>

        <!-- Profile Info -->
        <div class="p-4 border-b-2 border-black bg-gray-50">
          <p class="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">${cfg.label}</p>
          <p class="font-black text-sm mt-0.5 truncate">${cfg.icon} ${session.profNome || 'Coordenação'}</p>
          <p class="text-[10px] font-bold text-gray-500 mt-1 truncate" title="${session.escolaNome || ''}">
            ${session.perfil === 'admin' ? '🌐 Acesso global do sistema' : `🏫 ${session.escolaNome || 'Escola não definida'}`}
          </p>
        </div>

        <!-- Nav Items -->
        <nav class="flex-1 overflow-y-auto py-4 px-3">
          <ul class="space-y-2" id="sidebar-nav">
            ${menus.map(m => `
              <li>
                <button data-page="${m.id}" onclick="window.__navigateTo('${m.id}')"
                  class="nav-btn w-full flex items-center justify-start gap-3 px-4 py-3 font-bold uppercase tracking-wider text-xs text-left transition-all border-2 border-transparent text-gray-500 hover:border-black hover:bg-gray-50">
                  <i data-lucide="${m.icon}" class="w-5 h-5"></i>
                  <span class="text-left leading-tight">${m.label}</span>
                </button>
              </li>
            `).join('')}
          </ul>
        </nav>

        <!-- Logout Button -->
        <div class="p-3 border-t-4 border-black">
          <button onclick="window.__logout()" class="w-full bg-red-50 border-2 border-black text-red-700 px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            Sair do Sistema
          </button>
        </div>
      </aside>

      <!-- ====== MAIN CONTENT AREA ====== -->
      <div class="flex-1 flex flex-col h-full min-w-0">

        <!-- Mobile Header -->
        <header class="md:hidden bg-white border-b-4 border-black px-4 py-3 flex justify-between items-center sticky top-0 z-20">
          <div class="flex items-center gap-3">
            <button onclick="window.__toggleSidebar()" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-gray-50 hover:bg-gray-100 transition-colors">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>
            <div>
              <h1 class="font-black uppercase tracking-wider text-sm leading-tight" id="mobile-title">Dashboard</h1>
              <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate max-w-[150px]" title="${session.escolaNome || ''}">
                ${session.perfil === 'admin'
                  ? 'Admin'
                  : (session.escolaNome || (session.profNome ? session.profNome.split(' ')[0] : 'Coordenação'))}
              </p>
            </div>
          </div>
          <button onclick="window.__logout()" class="p-1.5 border-2 border-black btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
            <i data-lucide="log-out" class="w-4 h-4"></i>
          </button>
        </header>

        <!-- Page Content -->
        <main id="page-content" class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#f4f4f5] pb-8">
          <div class="max-w-5xl mx-auto"></div>
        </main>

      </div>
    </div>
  `;

  // Expose global functions
  window.__toggleSidebar = toggleSidebar;
  window.__navigateTo = navigateTo;
  window.__logout = logout;

  // Render icons
  if (window.lucide) lucide.createIcons();

  // Navigate to first page
  navigateTo(menus[0].id);
  preloadProfilePages(session.perfil, menus[0].id);
}

// =====================================================
// NAVIGATION
// =====================================================
async function navigateTo(pageId) {
  const menus = MENUS[session.perfil] || [];
  const menu = menus.find(m => m.id === pageId);
  if (!menu) return;
  const mySeq = ++navigationSeq;

  currentPage = pageId;

  // Update sidebar active state
  document.querySelectorAll('#sidebar-nav .nav-btn').forEach(btn => {
    const isActive = btn.dataset.page === pageId;
    if (isActive) {
      btn.classList.add('nav-active');
      btn.classList.remove('border-transparent', 'text-gray-500');
    } else {
      btn.classList.remove('nav-active');
      btn.classList.add('border-transparent', 'text-gray-500');
    }
  });

  // Update mobile title
  const mTitle = document.getElementById('mobile-title');
  if (mTitle) mTitle.textContent = menu.label;

  // Render page content
  const container = document.getElementById('page-content');
  container.scrollTop = 0;
  container.innerHTML = '<div class="max-w-5xl mx-auto page-enter"></div>';
  const inner = container.querySelector('.max-w-5xl');

  // Await async page renders (Dashboard, Cadastros, Dossiê, etc.)
  try {
    await menu.render(inner, session);
  } catch (err) {
    console.error(`Erro ao renderizar página "${menu.id}":`, err);
    if (mySeq !== navigationSeq) return;
    inner.innerHTML = `
      <div class="bg-red-50 border-2 border-black p-4">
        <p class="text-sm font-black text-red-700 uppercase tracking-wider">Erro ao carregar esta página.</p>
        <p class="text-xs font-bold text-red-600 mt-1">Tente novamente. Se persistir, verifique a conexão com Firebase.</p>
      </div>
    `;
  }
  if (mySeq !== navigationSeq) return;

  // Re-render icons
  if (window.lucide) lucide.createIcons();

  // Close mobile sidebar if open
  closeSidebar();
}

// =====================================================
// SIDEBAR TOGGLE
// =====================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  sidebar.classList.toggle('-translate-x-full');
  if (overlay) overlay.classList.toggle('hidden');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
    sidebar.classList.add('-translate-x-full');
  }
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
  }
}

// =====================================================
// LOGOUT
// =====================================================
function logout() {
  clearSession();
  session = null;
  currentPage = null;
  showLogin();
}

// =====================================================
// BOOT
// =====================================================
document.addEventListener('DOMContentLoaded', initApp);
