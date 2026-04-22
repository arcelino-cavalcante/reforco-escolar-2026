/**
 * 🧭 HUB DE ANÁLISE DE EVOLUÇÃO — Coordenação
 * Organiza os painéis analíticos em abas.
 */

function lazyTabRender(importer, exportName) {
  let renderFn = null;
  return async (...args) => {
    if (!renderFn) {
      const mod = await importer();
      renderFn = mod?.[exportName];
      if (typeof renderFn !== 'function') {
        throw new Error(`Render "${exportName}" não encontrado para aba de análise.`);
      }
    }
    return renderFn(...args);
  };
}

const TABS = [
  {
    id: 'visao-geral',
    label: 'Resumo',
    icon: 'bar-chart-2',
    hint: 'Resumo geral dos atendimentos e evolução.',
    render: lazyTabRender(() => import('./analise-evolucao.js'), 'renderAnaliseEvolucao')
  },
  {
    id: 'frequencia-risco',
    label: 'Faltas',
    icon: 'shield-alert',
    hint: 'Quem faltou e por qual motivo.',
    render: lazyTabRender(() => import('./frequencia-risco.js'), 'renderFrequenciaRisco')
  },
  {
    id: 'gargalos-habilidade',
    label: 'Habilidades',
    icon: 'target',
    hint: 'Habilidades com maior dificuldade.',
    render: lazyTabRender(() => import('./gargalos-habilidade.js'), 'renderGargalosHabilidade')
  },
  {
    id: 'socioemocional-engajamento',
    label: 'Comportamento',
    icon: 'heart-pulse',
    hint: 'Estado emocional e participação dos alunos.',
    render: lazyTabRender(() => import('./socioemocional-engajamento.js'), 'renderSocioemocionalEngajamento')
  },
  {
    id: 'efetividade-intervencao',
    label: 'Intervenções',
    icon: 'flask-conical',
    hint: 'Atividades que geram mais ganho de compreensão.',
    render: lazyTabRender(() => import('./efetividade-intervencao.js'), 'renderEfetividadeIntervencao')
  }
];

export async function renderAnaliseEvolucaoHub(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  let activeTab = 'visao-geral';
  let renderToken = 0;

  renderShell();
  await renderActiveTab();

  function renderShell() {
    const currentTab = getTab(activeTab);
    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4">
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Análises da Coordenação</p>
          <div id="ae-tabs" class="flex gap-2 overflow-x-auto pb-1">
            ${TABS.map((t) => `
              <button data-tab="${t.id}" class="ae-tab-btn flex items-center gap-2 px-3 py-2 border-2 border-black font-black uppercase tracking-wider text-[10px] whitespace-nowrap transition-colors ${tabButtonClasses(t.id, t.id === activeTab)}">
                <span class="ae-tab-icon w-5 h-5 border border-black rounded-sm flex items-center justify-center ${tabIconClasses(t.id, t.id === activeTab)}">
                  <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
                </span>
                ${t.label}
              </button>
            `).join('')}
          </div>
          <p id="ae-tab-hint" class="mt-2 text-[10px] font-bold uppercase tracking-wider ${tabHintClasses(currentTab.id)}">${currentTab.hint}</p>
        </div>

        <div id="ae-tab-content"></div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    container.querySelectorAll('.ae-tab-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tabId = e.currentTarget.dataset.tab;
        if (!tabId || tabId === activeTab) return;
        activeTab = tabId;
        updateActiveStyles();
        await renderActiveTab();
      });
    });
  }

  function updateActiveStyles() {
    container.querySelectorAll('.ae-tab-btn').forEach((btn) => {
      const on = btn.dataset.tab === activeTab;
      btn.className = `ae-tab-btn flex items-center gap-2 px-3 py-2 border-2 border-black font-black uppercase tracking-wider text-[10px] whitespace-nowrap transition-colors ${tabButtonClasses(btn.dataset.tab, on)}`;
      const iconWrap = btn.querySelector('.ae-tab-icon');
      if (iconWrap) {
        iconWrap.className = `ae-tab-icon w-5 h-5 border border-black rounded-sm flex items-center justify-center ${tabIconClasses(btn.dataset.tab, on)}`;
      }
    });

    const hint = container.querySelector('#ae-tab-hint');
    const tab = getTab(activeTab);
    if (hint) {
      hint.className = `mt-2 text-[10px] font-bold uppercase tracking-wider ${tabHintClasses(tab.id)}`;
      hint.textContent = tab.hint;
    }
  }

  async function renderActiveTab() {
    const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
    const host = container.querySelector('#ae-tab-content');
    if (!host) return;

    const myToken = ++renderToken;
    host.innerHTML = `
      <div class="bg-white border-2 border-black p-4 text-center">
        <p class="text-xs font-black uppercase tracking-wider text-gray-400">Carregando ${tab.label}...</p>
      </div>
    `;

    await tab.render(host, session);

    // Evita render antigo sobrescrevendo aba nova em trocas rápidas.
    if (myToken !== renderToken) return;
  }
}

function getTab(tabId) {
  return TABS.find((t) => t.id === tabId) || TABS[0];
}

function tabButtonClasses(tabId, active) {
  const style = TAB_STYLES[tabId] || TAB_STYLES['visao-geral'];
  return active ? style.activeBtn : style.inactiveBtn;
}

function tabIconClasses(tabId, active) {
  const style = TAB_STYLES[tabId] || TAB_STYLES['visao-geral'];
  return active ? style.activeIcon : style.inactiveIcon;
}

function tabHintClasses(tabId) {
  const style = TAB_STYLES[tabId] || TAB_STYLES['visao-geral'];
  return style.hint;
}

const TAB_STYLES = {
  'visao-geral': {
    activeBtn: 'bg-blue-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    inactiveBtn: 'bg-blue-50 text-blue-900 hover:bg-blue-100',
    activeIcon: 'bg-blue-500 text-white',
    inactiveIcon: 'bg-blue-200 text-blue-900',
    hint: 'text-blue-700'
  },
  'frequencia-risco': {
    activeBtn: 'bg-red-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    inactiveBtn: 'bg-red-50 text-red-900 hover:bg-red-100',
    activeIcon: 'bg-red-500 text-white',
    inactiveIcon: 'bg-red-200 text-red-900',
    hint: 'text-red-700'
  },
  'gargalos-habilidade': {
    activeBtn: 'bg-orange-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    inactiveBtn: 'bg-orange-50 text-orange-900 hover:bg-orange-100',
    activeIcon: 'bg-orange-500 text-white',
    inactiveIcon: 'bg-orange-200 text-orange-900',
    hint: 'text-orange-700'
  },
  'socioemocional-engajamento': {
    activeBtn: 'bg-rose-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    inactiveBtn: 'bg-rose-50 text-rose-900 hover:bg-rose-100',
    activeIcon: 'bg-rose-500 text-white',
    inactiveIcon: 'bg-rose-200 text-rose-900',
    hint: 'text-rose-700'
  },
  'efetividade-intervencao': {
    activeBtn: 'bg-emerald-600 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    inactiveBtn: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    activeIcon: 'bg-emerald-500 text-white',
    inactiveIcon: 'bg-emerald-200 text-emerald-900',
    hint: 'text-emerald-700'
  }
};
