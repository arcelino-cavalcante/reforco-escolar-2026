/**
 * 🛡️ ADMIN SISTEMA
 * Gestão de escolas e coordenadores.
 */

import {
  listarEscolas,
  criarEscola,
  listarCoordenadores,
  criarCoordenador,
  atualizarCoordenador,
  excluirCoordenador
} from '../db.js';

function esc(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderAdmin(container, session) {
  if (session?.perfil !== 'admin') {
    container.innerHTML = `
      <div class="animate-fade-in bg-red-50 border-2 border-black p-5">
        <p class="text-sm font-black text-red-700 uppercase tracking-wider">Acesso restrito ao admin do sistema.</p>
      </div>`;
    return;
  }

  let escolas = [];
  let coordenadores = [];
  let filtroEscolaId = '';
  let saving = false;

  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="border-b-4 border-black pb-4 mb-6">
        <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Admin do Sistema</h2>
        <p class="text-gray-500 font-bold text-sm mt-1">Carregando escolas e coordenadores...</p>
      </div>
      <div class="h-32 skeleton rounded"></div>
    </div>`;

  await loadAll();
  render();

  async function loadAll() {
    [escolas, coordenadores] = await Promise.all([
      listarEscolas(),
      listarCoordenadores()
    ]);

    if (!filtroEscolaId && escolas.length > 0) {
      filtroEscolaId = String(escolas[0].id || '');
    }
  }

  function getDefaultSchoolId() {
    return String(escolas.find((e) => e.is_default === true)?.id || '');
  }

  function coordEscolaId(c) {
    const raw = String(c?.escola_id || '').trim();
    return raw || getDefaultSchoolId();
  }

  function escolaNome(id) {
    return escolas.find((e) => String(e.id) === String(id))?.nome || 'Escola não encontrada';
  }

  function filteredCoords() {
    if (!filtroEscolaId) return coordenadores;
    return coordenadores.filter((c) => coordEscolaId(c) === String(filtroEscolaId));
  }

  function render() {
    const coordsFiltrados = filteredCoords();

    container.innerHTML = `
      <div class="animate-fade-in">
        <div class="border-b-4 border-black pb-4 mb-6">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Admin do Sistema</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Cadastre escolas e coordenadores por escola</p>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(16,185,129,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <i data-lucide="building-2" class="w-4 h-4 text-emerald-700"></i> Nova Escola
            </h3>
            <form id="form-admin-escola" class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome da escola *</label>
                <input id="admin-escola-nome" type="text" required placeholder="Ex: Escola Municipal Nova Esperança" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500">
              </div>
              <button type="submit" class="w-full bg-emerald-600 border-2 border-black text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}" ${saving ? 'disabled' : ''}>
                Cadastrar Escola
              </button>
            </form>
          </div>

          <div class="bg-white border-2 border-black p-5 shadow-[6px_6px_0px_0px_rgba(245,158,11,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4 flex items-center gap-2">
              <i data-lucide="user-plus" class="w-4 h-4 text-amber-700"></i> Novo Coordenador
            </h3>
            <form id="form-admin-coord" class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Escola *</label>
                <select id="admin-coord-escola" required class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500">
                  <option value="">Selecione...</option>
                  ${escolas.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nome *</label>
                <input id="admin-coord-nome" type="text" required placeholder="Ex: Maria da Coordenação" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500">
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Senha *</label>
                <input id="admin-coord-senha" type="text" required placeholder="Ex: 123456" class="w-full border-2 border-black p-2.5 bg-gray-50 font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500">
              </div>
              <button type="submit" class="w-full bg-amber-500 border-2 border-black text-black px-4 py-2.5 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-amber-600 ${saving ? 'opacity-60 cursor-not-allowed' : ''}" ${saving ? 'disabled' : ''}>
                Cadastrar Coordenador
              </button>
            </form>
          </div>
        </div>

        <div class="bg-white border-2 border-black p-4 mb-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-xs font-black uppercase tracking-wider">Coordenadores por Escola</p>
            <div class="flex items-center gap-2">
              <label class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Filtrar:</label>
              <select id="admin-filtro-escola" class="border-2 border-black p-2 bg-gray-50 font-bold text-xs outline-none">
                ${escolas.map((e) => `<option value="${e.id}" ${String(filtroEscolaId) === String(e.id) ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          ${coordsFiltrados.length === 0 ? `
            <div class="text-center py-8 text-gray-400 border-2 border-black bg-white">
              <p class="text-xs font-bold uppercase tracking-wider">Nenhum coordenador encontrado nesta escola.</p>
            </div>
          ` : coordsFiltrados.map((c) => {
            const isDefault = c.is_default === true;
            return `
              <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p class="font-black text-sm">${esc(c.nome)}</p>
                    <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${esc(escolaNome(coordEscolaId(c)))} ${isDefault ? '• padrão' : ''}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button data-action="reset-senha" data-id="${c.id}" class="bg-blue-50 border-2 border-black px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100">
                      Resetar 123456
                    </button>
                    <button data-action="excluir-coord" data-id="${c.id}" ${isDefault ? 'disabled' : ''} class="${isDefault ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'} bg-red-50 border-2 border-black px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    bindEvents();
  }

  function bindEvents() {
    container.querySelector('#admin-filtro-escola')?.addEventListener('change', (e) => {
      filtroEscolaId = String(e?.target?.value || '');
      render();
    });

    container.querySelector('#form-admin-escola')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = String(container.querySelector('#admin-escola-nome')?.value || '').trim();
      if (!nome) return;
      saving = true;
      render();
      try {
        await criarEscola(nome);
        await loadAll();
      } catch (err) {
        alert('Erro ao cadastrar escola: ' + String(err?.message || err));
      }
      saving = false;
      render();
    });

    container.querySelector('#form-admin-coord')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const escolaId = String(container.querySelector('#admin-coord-escola')?.value || '').trim();
      const nome = String(container.querySelector('#admin-coord-nome')?.value || '').trim();
      const senha = String(container.querySelector('#admin-coord-senha')?.value || '').trim();
      if (!escolaId || !nome || !senha) return;
      saving = true;
      render();
      try {
        await criarCoordenador(nome, senha, escolaId);
        await loadAll();
        filtroEscolaId = escolaId;
      } catch (err) {
        alert('Erro ao cadastrar coordenador: ' + String(err?.message || err));
      }
      saving = false;
      render();
    });

    container.querySelectorAll('[data-action="reset-senha"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = String(btn?.dataset?.id || '');
        if (!id) return;
        try {
          await atualizarCoordenador(id, { senha: '123456' });
          await loadAll();
          render();
        } catch (err) {
          alert('Erro ao resetar senha: ' + String(err?.message || err));
        }
      });
    });

    container.querySelectorAll('[data-action="excluir-coord"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = String(btn?.dataset?.id || '');
        if (!id || btn.hasAttribute('disabled')) return;
        const ok = window.confirm('Deseja realmente excluir este coordenador?');
        if (!ok) return;
        try {
          await excluirCoordenador(id);
          await loadAll();
          render();
        } catch (err) {
          alert('Erro ao excluir coordenador: ' + String(err?.message || err));
        }
      });
    });
  }
}
