/**
 * 🤖 IA TUTOR — Coordenação
 * Chat pedagógico com tool-calling usando dados reais do Firestore.
 */

import {
  obterContextoIA,
  salvarContextoIA,
  toolListarAlunosIA,
  toolListarRegistrosMesIA,
  toolBuscarHistoricoAlunoIA,
  toolListarProfsReforcoIA,
  toolResumoProfessorReforcoIA,
  toolResumoSistemaIA,
  toolConsultarColecaoIA
} from '../db.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_KEY_STORAGE = 'reforco_openai_api_key';
const OPENAI_MODEL_STORAGE = 'reforco_openai_model';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITEMS = 160;

const STATE = {
  fingerprint: '',
  messages: [],
  busy: false,
  apiKey: '',
  rememberKey: false,
  model: DEFAULT_MODEL,
  draft: '',
  error: '',
  memoryText: '',
  memoryDraft: '',
  memoryLoaded: false,
  memoryBusy: false,
  memoryStatus: ''
};

const SUGESTOES = [
  {
    id: 'sug-1',
    label: 'Habilidades com mais gargalos',
    prompt: 'Considerando o mês atual, liste as habilidades que apresentaram mais dificuldade e gargalos pelos alunos, e separe por disciplina.'
  },
  {
    id: 'sug-2',
    label: 'Alunos que mais faltaram no mês',
    prompt: 'Liste detalhadamente quais alunos mais faltaram neste mês e os motivos das faltas deles segundo o diário dos professores.'
  },
  {
    id: 'sug-3',
    label: 'Destaques com autonomia',
    prompt: 'Analisando este mês, quais alunos alcançaram níveis de compreensão autônomos e focados e poderiam futuramente receber alta?'
  }
];

const TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'tool_listar_alunos',
      description: 'Lista todos os alunos matriculados no reforço e suas respectivas turmas. Útil para descobrir se um aluno existe e em qual turma ele está lotado.',
      parameters: {
        type: 'object',
        properties: {
          turma_nome: {
            type: 'string',
            description: "Nome da turma para filtrar (ex: '3º Ano A'). Passe 'Todas' para listar a escola inteira."
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_listar_registros_mes',
      description: 'Retorna uma lista massiva com todos os registros diários de um mês específico para análises de gargalos, faltas e estado emocional.',
      parameters: {
        type: 'object',
        properties: {
          mes: { type: 'integer', description: 'Mês numérico (ex: 4 para abril).' },
          ano: { type: 'integer', description: 'Ano numérico (ex: 2026).' }
        },
        required: ['mes', 'ano']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_buscar_historico_aluno',
      description: 'Busca todas as anotações do diário focadas em um aluno específico, trazendo cronologia e percepções pedagógicas.',
      parameters: {
        type: 'object',
        properties: {
          nome_aluno_parcial: {
            type: 'string',
            description: "Nome, sobrenome, ou fragmento do nome do aluno procurado (ex: 'Maria')."
          }
        },
        required: ['nome_aluno_parcial']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_listar_professores_reforco',
      description: 'Lista professores de reforço com área, turmas e quantidade de alunos vinculados.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_resumo_professor_reforco',
      description: 'Retorna resumo completo de um professor de reforço: total de alunos, turmas, atendimentos e faltas recentes.',
      parameters: {
        type: 'object',
        properties: {
          nome_prof_parcial: {
            type: 'string',
            description: "Nome completo ou parcial do professor de reforço (ex: 'Mackson')."
          }
        },
        required: ['nome_prof_parcial']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_resumo_sistema',
      description: 'Retorna um panorama geral atualizado do sistema: totais de alunos, professores, registros e encaminhamentos.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_consultar_colecao',
      description: 'Consulta ampla em coleções do sistema (estudantes, turmas, professores_reforco, professores_regentes, registros_diarios, consolidados_mensais, encaminhamentos). Útil para perguntas avançadas com filtros.',
      parameters: {
        type: 'object',
        properties: {
          colecao: {
            type: 'string',
            description: "Coleção para consulta. Ex.: 'registros_diarios', 'estudantes', 'encaminhamentos'."
          },
          filtros: {
            type: 'object',
            description: "Mapa simples de filtros (chave->valor). Para texto, aplica busca parcial. Ex.: {\"prof_nome\":\"Mackson\"}."
          },
          limite: {
            type: 'integer',
            description: 'Limite máximo de itens retornados (1 a 500).'
          }
        },
        required: ['colecao']
      }
    }
  }
];

const TOOL_HANDLERS = {
  tool_listar_alunos: async (args) => toolListarAlunosIA(args?.turma_nome || 'Todas'),
  tool_listar_registros_mes: async (args) => toolListarRegistrosMesIA(args?.mes, args?.ano),
  tool_buscar_historico_aluno: async (args) => toolBuscarHistoricoAlunoIA(args?.nome_aluno_parcial),
  tool_listar_professores_reforco: async () => toolListarProfsReforcoIA(),
  tool_resumo_professor_reforco: async (args) => toolResumoProfessorReforcoIA(args?.nome_prof_parcial),
  tool_resumo_sistema: async () => toolResumoSistemaIA(),
  tool_consultar_colecao: async (args) => toolConsultarColecaoIA(args?.colecao, args?.filtros || {}, args?.limite || 200)
};

export async function renderIATutor(container, session) {
  if (session?.perfil !== 'coordenacao') {
    container.innerHTML = `
      <div class="animate-fade-in bg-red-50 border-2 border-black p-5">
        <p class="text-sm font-black text-red-700 uppercase tracking-wider">Acesso restrito à coordenação.</p>
      </div>`;
    return;
  }

  hydrateState(session);
  await ensureMemoryLoaded();
  await paint(container, session);
}

async function ensureMemoryLoaded() {
  if (STATE.memoryLoaded) return;
  try {
    const memoria = await obterContextoIA();
    STATE.memoryText = String(memoria || '');
    STATE.memoryDraft = STATE.memoryText;
  } catch (err) {
    STATE.memoryText = '';
    STATE.memoryDraft = '';
    STATE.error = 'Não consegui carregar a memória pedagógica da IA agora.';
  } finally {
    STATE.memoryLoaded = true;
  }
}

function hydrateState(session) {
  const fp = `${session?.perfil || ''}:${session?.profId || 'coord'}`;
  if (STATE.fingerprint !== fp) {
    STATE.fingerprint = fp;
    STATE.messages = [];
    STATE.busy = false;
    STATE.draft = '';
    STATE.error = '';
    STATE.memoryText = '';
    STATE.memoryDraft = '';
    STATE.memoryLoaded = false;
    STATE.memoryBusy = false;
    STATE.memoryStatus = '';
  }

  if (!STATE.apiKey) {
    const persisted = localStorage.getItem(OPENAI_KEY_STORAGE) || '';
    const tabKey = sessionStorage.getItem(OPENAI_KEY_STORAGE) || '';
    STATE.apiKey = tabKey || persisted;
    STATE.rememberKey = Boolean(persisted);
  }

  const modelStored = localStorage.getItem(OPENAI_MODEL_STORAGE);
  if (modelStored) STATE.model = modelStored;
}

async function paint(container, session) {
  container.innerHTML = `
    <div class="animate-fade-in">
      <div class="border-b-4 border-black pb-4 mb-6">
        <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">IA Tutor</h2>
        <p class="text-gray-500 font-bold text-sm mt-1">Assistente da coordenação com respostas organizadas e ancoradas nos dados do reforço.</p>
      </div>

      ${STATE.error ? `
        <div class="bg-red-50 border-2 border-black p-3 mb-4">
          <p class="text-xs font-black text-red-700">${escapeHtml(STATE.error)}</p>
        </div>
      ` : ''}

      <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4">
        <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Configuração da IA</p>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div class="md:col-span-2">
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">OpenAI API Key</label>
            <input id="ia-openai-key" type="password" value="${escapeAttr(STATE.apiKey)}" placeholder="sk-..." class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none" autocomplete="off">
          </div>
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Modelo</label>
            <select id="ia-model" class="w-full border-2 border-black p-2 bg-gray-50 font-bold text-sm outline-none">
              ${modelOptionsHTML(STATE.model)}
            </select>
          </div>
          <div class="flex items-end">
            <button id="ia-save-key" class="w-full bg-black border-2 border-black text-white px-3 py-2 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Aplicar
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 mt-2">
          <label class="inline-flex items-center gap-2 text-xs font-bold text-gray-600">
            <input id="ia-remember-key" type="checkbox" class="accent-black" ${STATE.rememberKey ? 'checked' : ''}>
            Lembrar chave neste navegador
          </label>
        </div>
        <p class="text-[10px] font-bold text-gray-400 mt-2">A chave é usada somente neste navegador para consultar a IA.</p>
      </div>

      <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4">
        <div class="flex items-center justify-between gap-2 mb-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-gray-400">Memória Pedagógica da IA</p>
          <span class="text-[10px] font-black text-gray-500">${STATE.memoryDraft.length} caracteres</span>
        </div>
        <textarea id="ia-memory" rows="5" placeholder="Ex.: prioridades da escola, tom esperado, regras de comunicação, foco por etapa..." class="w-full border-2 border-black p-2 bg-white font-bold text-xs outline-none resize-y" ${STATE.memoryBusy ? 'disabled' : ''}>${escapeHtml(STATE.memoryDraft)}</textarea>
        <div class="flex flex-wrap items-center gap-2 mt-2">
          <button id="ia-memory-save" class="bg-emerald-600 border-2 border-black text-white px-3 py-1.5 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${STATE.memoryBusy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-700'}" ${STATE.memoryBusy ? 'disabled' : ''}>
            ${STATE.memoryBusy ? 'Salvando...' : 'Salvar Memória'}
          </button>
          <button id="ia-memory-reset" class="bg-white border-2 border-black text-black px-3 py-1.5 font-black uppercase tracking-wider text-[10px] btn-brutal shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 ${STATE.memoryBusy ? 'opacity-60 cursor-not-allowed' : ''}" ${STATE.memoryBusy ? 'disabled' : ''}>
            Recarregar
          </button>
          ${STATE.memoryStatus ? `<span class="text-[10px] font-black text-emerald-700">${escapeHtml(STATE.memoryStatus)}</span>` : ''}
        </div>
        <p class="text-[10px] font-bold text-gray-400 mt-2">Essa memória é persistente e influencia todas as respostas da IA Tutor.</p>
      </div>

      <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4">
        <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Perguntas rápidas</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          ${SUGESTOES.map((s) => `
            <button data-sug-id="${s.id}" class="ia-sug-btn border-2 border-black bg-yellow-50 hover:bg-yellow-100 transition-colors px-3 py-2 text-xs font-black text-left uppercase tracking-wider">
              ${escapeHtml(s.label)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <div class="px-4 py-3 border-b-2 border-black bg-black text-white flex items-center justify-between">
          <span class="text-[11px] font-black uppercase tracking-wider">Chat IA Tutor</span>
          <span class="text-[10px] font-black uppercase tracking-wider text-yellow-300">Respostas Baseadas em Dados</span>
          <button id="ia-clear-chat" class="bg-white text-black border-2 border-white px-2 py-1 text-[10px] font-black uppercase tracking-wider hover:bg-gray-100">
            Limpar histórico
          </button>
        </div>

        <div id="ia-chat-box" class="h-[50vh] md:h-[56vh] overflow-y-auto p-4 bg-gray-50 space-y-3">
          ${chatMessagesHTML()}
        </div>

        <div class="border-t-2 border-black p-3 bg-white">
          <div class="flex flex-col gap-2">
            <textarea id="ia-input" rows="3" placeholder="O que você deseja descobrir sobre os dados do reforço?" class="w-full border-2 border-black p-2 bg-white font-bold text-sm outline-none resize-none" ${STATE.busy ? 'disabled' : ''}>${escapeHtml(STATE.draft)}</textarea>
            <div class="flex items-center justify-between gap-2">
              <p class="text-[10px] font-bold text-gray-400">A IA consulta os dados do Firebase antes de responder perguntas de análise.</p>
              <button id="ia-send" class="bg-blue-500 border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${STATE.busy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-600'}" ${STATE.busy ? 'disabled' : ''}>
                ${STATE.busy ? 'Consultando banco...' : 'Perguntar à IA'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  bindEvents(container, session);
  if (window.lucide) lucide.createIcons();
  scrollChatToBottom(container);
}

function bindEvents(container, session) {
  container.querySelector('#ia-save-key')?.addEventListener('click', async () => {
    const keyInput = container.querySelector('#ia-openai-key');
    const rememberInput = container.querySelector('#ia-remember-key');
    const modelInput = container.querySelector('#ia-model');
    STATE.apiKey = String(keyInput?.value || '').trim();
    STATE.rememberKey = Boolean(rememberInput?.checked);
    STATE.model = String(modelInput?.value || DEFAULT_MODEL);
    persistKeyAndModel();
    STATE.error = STATE.apiKey ? '' : 'Informe uma API Key válida para usar o IA Tutor.';
    await paint(container, session);
  });

  container.querySelector('#ia-memory')?.addEventListener('input', (e) => {
    STATE.memoryDraft = String(e?.target?.value || '');
    STATE.memoryStatus = '';
  });

  container.querySelector('#ia-memory-save')?.addEventListener('click', async () => {
    if (STATE.memoryBusy) return;
    STATE.memoryBusy = true;
    STATE.memoryStatus = '';
    await paint(container, session);
    try {
      await salvarContextoIA(STATE.memoryDraft);
      STATE.memoryText = STATE.memoryDraft;
      STATE.memoryStatus = 'Memória atualizada com sucesso.';
    } catch (err) {
      STATE.error = 'Não consegui salvar a memória da IA agora.';
    } finally {
      STATE.memoryBusy = false;
      await paint(container, session);
    }
  });

  container.querySelector('#ia-memory-reset')?.addEventListener('click', async () => {
    if (STATE.memoryBusy) return;
    STATE.memoryBusy = true;
    STATE.memoryStatus = '';
    await paint(container, session);
    try {
      const mem = await obterContextoIA();
      STATE.memoryText = String(mem || '');
      STATE.memoryDraft = STATE.memoryText;
      STATE.memoryStatus = 'Memória recarregada.';
    } catch (err) {
      STATE.error = 'Não consegui recarregar a memória da IA agora.';
    } finally {
      STATE.memoryBusy = false;
      await paint(container, session);
    }
  });

  container.querySelector('#ia-clear-chat')?.addEventListener('click', async () => {
    if (STATE.busy) return;
    STATE.messages = [];
    STATE.draft = '';
    STATE.error = '';
    await paint(container, session);
  });

  container.querySelectorAll('.ia-sug-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      if (STATE.busy) return;
      const sugId = e.currentTarget?.dataset?.sugId;
      const sug = SUGESTOES.find((s) => s.id === sugId);
      if (!sug) return;
      STATE.draft = sug.prompt;
      await paint(container, session);
      const input = container.querySelector('#ia-input');
      if (input) {
        input.focus();
        input.selectionStart = input.value.length;
        input.selectionEnd = input.value.length;
      }
    });
  });

  const input = container.querySelector('#ia-input');
  input?.addEventListener('input', (e) => {
    STATE.draft = e.target.value || '';
  });
  input?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSend(container, session);
    }
  });

  container.querySelector('#ia-send')?.addEventListener('click', async () => {
    await handleSend(container, session);
  });
}

async function handleSend(container, session) {
  if (STATE.busy) return;

  const prompt = String(container.querySelector('#ia-input')?.value || '').trim();
  const key = String(container.querySelector('#ia-openai-key')?.value || STATE.apiKey || '').trim();
  const remember = Boolean(container.querySelector('#ia-remember-key')?.checked);
  const model = String(container.querySelector('#ia-model')?.value || DEFAULT_MODEL);

  STATE.apiKey = key;
  STATE.rememberKey = remember;
  STATE.model = model;
  STATE.draft = '';
  persistKeyAndModel();

  if (!STATE.apiKey) {
    STATE.error = 'Informe a OpenAI API Key para iniciar o IA Tutor.';
    await paint(container, session);
    return;
  }
  if (!prompt) return;

  STATE.error = '';
  STATE.messages.push({
    role: 'user',
    content: prompt,
    createdAt: Date.now()
  });
  STATE.busy = true;
  await paint(container, session);

  try {
    const resposta = await runTutorFlow(prompt);
    STATE.messages.push({
      role: 'assistant',
      content: String(resposta?.content || '').trim() || 'Não consegui montar uma resposta útil com os dados atuais.',
      sources: Array.isArray(resposta?.sources) ? resposta.sources : [],
      createdAt: Date.now()
    });
  } catch (err) {
    const msg = normalizeErrorMessage(err);
    STATE.error = msg;
    STATE.messages.push({
      role: 'assistant',
      content: `Não consegui concluir a consulta agora. ${msg}`,
      createdAt: Date.now()
    });
  } finally {
    STATE.busy = false;
    await paint(container, session);
  }
}

async function runTutorFlow(userPrompt) {
  const systemPrompt = buildSystemPrompt();
  const conversation = [{ role: 'system', content: systemPrompt }, ...apiHistoryMessages()];
  const sources = [];
  const MAX_TOOL_ROUNDS = 4;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const resp = await callOpenAI({
      apiKey: STATE.apiKey,
      model: STATE.model,
      messages: conversation,
      tools: TOOLS_SCHEMA,
      toolChoice: 'auto'
    });

    const msg = resp?.choices?.[0]?.message;
    if (!msg) throw new Error('A API não retornou resposta válida.');

    let toolCalls = normalizeToolCalls(msg.tool_calls);

    // Fallback: se pergunta pede dados e a IA não acionou tools na primeira rodada, força consulta.
    if (round === 0 && toolCalls.length === 0 && isLikelyDataQuestion(userPrompt)) {
      toolCalls = [buildFallbackToolCall(userPrompt)];
      conversation.push({
        role: 'assistant',
        content: 'Vou consultar os dados da base para responder com precisão.',
        tool_calls: toolCalls
      });
    } else {
      const assistantMsg = { role: 'assistant', content: msg.content || '' };
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      conversation.push(assistantMsg);
    }

    if (toolCalls.length === 0) {
      return {
        content: String(msg.content || '').trim(),
        sources: mergeSources(sources)
      };
    }

    for (const call of toolCalls) {
      const { payload, source } = await executeToolCall(call);
      if (source) sources.push(source);
      conversation.push({
        role: 'tool',
        tool_call_id: call.id || `tool_${Date.now()}`,
        name: call?.function?.name || 'tool_desconhecida',
        content: JSON.stringify(payload, null, 0)
      });
    }
  }

  // Segurança: se o modelo insistir em tools sem concluir, força fechamento textual.
  const final = await callOpenAI({
    apiKey: STATE.apiKey,
    model: STATE.model,
    messages: conversation
  });

  const finalMsg = final?.choices?.[0]?.message?.content || '';
  return {
    content: finalMsg,
    sources: mergeSources(sources)
  };
}

function apiHistoryMessages() {
  const msgs = STATE.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES);

  return msgs.map((m) => ({ role: m.role, content: m.content }));
}

async function executeToolCall(call) {
  const name = call?.function?.name;
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return {
      payload: { erro: `Ferramenta '${name}' não está disponível.` },
      source: {
        tool: name || 'tool_desconhecida',
        label: labelFromTool(name),
        count: 0,
        truncated: false
      }
    };
  }

  let args = {};
  const rawArgs = call?.function?.arguments || '{}';
  try {
    args = JSON.parse(rawArgs);
  } catch (err) {
    return {
      payload: { erro: `Argumentos inválidos para a ferramenta '${name}'.` },
      source: {
        tool: name,
        label: labelFromTool(name),
        count: 0,
        truncated: false
      }
    };
  }

  try {
    const raw = await handler(args);
    const { payload, count, truncated } = trimToolPayload(raw);
    return {
      payload,
      source: {
        tool: name,
        label: labelFromTool(name),
        count,
        truncated
      }
    };
  } catch (err) {
    return {
      payload: { erro: String(err?.message || err || 'Falha ao consultar o banco de dados.') },
      source: {
        tool: name,
        label: labelFromTool(name),
        count: 0,
        truncated: false
      }
    };
  }
}

function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .filter((t) => t && t.function && t.function.name)
    .map((t, idx) => ({
      ...t,
      id: t.id || `tool_call_${Date.now()}_${idx}`
    }));
}

function isLikelyDataQuestion(texto) {
  const txt = String(texto || '').toLowerCase();
  const keywords = [
    'aluno', 'alunos', 'turma', 'falt', 'frequ', 'registro', 'dados', 'históric', 'historico',
    'habilidade', 'compreens', 'participa', 'emocional', 'professor', 'mês', 'mes', 'ano',
    'gargalo', 'interven', 'encaminh', 'relatório', 'relatorio', 'listar', 'mostre', 'quais', 'quantos'
  ];
  return keywords.some((k) => txt.includes(k));
}

function buildFallbackToolCall(texto) {
  const txt = String(texto || '').toLowerCase();

  // Perguntas de contagem por professor de reforço.
  if ((txt.includes('professor') || txt.includes('reforço') || txt.includes('reforco')) && (txt.includes('quantos') || txt.includes('quantidade') || txt.includes('qtd') || txt.includes('total'))) {
    const nomeProf = extrairNomeProfessor(texto);
    if (!nomeProf) {
      return {
        id: `fallback_${Date.now()}`,
        function: {
          name: 'tool_listar_professores_reforco',
          arguments: JSON.stringify({})
        }
      };
    }
    return {
      id: `fallback_${Date.now()}`,
      function: {
        name: 'tool_resumo_professor_reforco',
        arguments: JSON.stringify({ nome_prof_parcial: nomeProf })
      }
    };
  }

  if (txt.includes('históric') || txt.includes('historico')) {
    return {
      id: `fallback_${Date.now()}`,
      function: {
        name: 'tool_buscar_historico_aluno',
        arguments: JSON.stringify({ nome_aluno_parcial: extrairNomeParaHistorico(texto) })
      }
    };
  }

  if (txt.includes('turma') && (txt.includes('aluno') || txt.includes('alunos'))) {
    return {
      id: `fallback_${Date.now()}`,
      function: {
        name: 'tool_listar_alunos',
        arguments: JSON.stringify({ turma_nome: 'Todas' })
      }
    };
  }

  if (txt.includes('resumo') || txt.includes('panorama') || txt.includes('visão geral') || txt.includes('visao geral')) {
    return {
      id: `fallback_${Date.now()}`,
      function: {
        name: 'tool_resumo_sistema',
        arguments: JSON.stringify({})
      }
    };
  }

  const now = new Date();
  return {
    id: `fallback_${Date.now()}`,
    function: {
      name: 'tool_listar_registros_mes',
      arguments: JSON.stringify({ mes: now.getMonth() + 1, ano: now.getFullYear() })
    }
  };
}

function extrairNomeParaHistorico(texto) {
  const raw = String(texto || '').trim();
  const semPergunta = raw.replace(/[?.!]/g, ' ');
  const tokens = semPergunta.split(/\s+/).filter(Boolean);
  const ignorar = new Set(['historico', 'histórico', 'do', 'da', 'de', 'aluno', 'aluna', 'mostrar', 'mostre', 'ver', 'quero']);
  const candidatos = tokens.filter((t) => !ignorar.has(t.toLowerCase()) && t.length > 2);
  return candidatos.join(' ') || raw;
}

function extrairNomeProfessor(texto) {
  const raw = String(texto || '').trim();
  const semPont = raw.replace(/[?.!,:;]/g, ' ').replace(/\s+/g, ' ').trim();

  const afterProfessor = semPont.match(/\bprof(?:essor|essora)?\b\s+(?:de\s+refor[cç]o\s+)?(.+)$/i);
  if (afterProfessor && afterProfessor[1]) {
    const recorte = afterProfessor[1]
      .replace(/\b(tem|possui|temos|têm|qtd|quantidade|total|alunos?|alunas?)\b.*$/i, '')
      .trim();
    if (recorte && recorte.split(/\s+/).filter(Boolean).length <= 5) return recorte;
  }

  const afterNome = semPont.match(/\bnome\s+(?:do|da)?\s*prof(?:essor|essora)?\s+(.+)$/i);
  if (afterNome && afterNome[1]) return afterNome[1].trim();

  const tokens = semPont.split(/\s+/).filter(Boolean);
  const stop = new Set([
    'quantos', 'quantas', 'quantidade', 'qtd', 'total', 'alunos', 'aluno', 'tem', 'tem?', 'possui',
    'o', 'a', 'do', 'da', 'de', 'professor', 'professora', 'prof', 'reforço', 'reforco', 'no', 'na',
    'com', 'para', 'que', 'qual', 'quais'
  ]);
  const candidatos = tokens.filter((t) => !stop.has(t.toLowerCase()) && t.length > 2);
  if (candidatos.length === 0) return '';
  return candidatos.join(' ');
}

function labelFromTool(toolName) {
  if (toolName === 'tool_listar_alunos') return 'Alunos e Turmas';
  if (toolName === 'tool_listar_registros_mes') return 'Registros do Mês';
  if (toolName === 'tool_buscar_historico_aluno') return 'Histórico do Aluno';
  if (toolName === 'tool_listar_professores_reforco') return 'Professores de Reforço';
  if (toolName === 'tool_resumo_professor_reforco') return 'Resumo por Professor';
  if (toolName === 'tool_resumo_sistema') return 'Resumo do Sistema';
  if (toolName === 'tool_consultar_colecao') return 'Consulta por Coleção';
  return 'Dados Consultados';
}

function trimToolPayload(payload) {
  if (Array.isArray(payload)) {
    const total = payload.length;
    if (total <= MAX_TOOL_ITEMS) {
      return { payload, count: total, truncated: false };
    }
    return {
      payload: payload.slice(0, MAX_TOOL_ITEMS),
      count: total,
      truncated: true
    };
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.historico_aulas)) {
    const total = payload.historico_aulas.length;
    if (total <= MAX_TOOL_ITEMS) {
      return { payload, count: total, truncated: false };
    }
    return {
      payload: {
        ...payload,
        historico_aulas: payload.historico_aulas.slice(0, MAX_TOOL_ITEMS)
      },
      count: total,
      truncated: true
    };
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.itens)) {
    const total = Number(payload.total_encontrado || payload.itens.length || 0);
    if (payload.itens.length <= MAX_TOOL_ITEMS) {
      return { payload, count: total || payload.itens.length, truncated: false };
    }
    return {
      payload: {
        ...payload,
        itens: payload.itens.slice(0, MAX_TOOL_ITEMS)
      },
      count: total || payload.itens.length,
      truncated: true
    };
  }

  return { payload, count: 1, truncated: false };
}

function mergeSources(sources) {
  const map = new Map();
  (sources || []).forEach((s) => {
    const key = String(s?.tool || s?.label || 'source');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        tool: s?.tool || key,
        label: s?.label || 'Dados',
        count: Number(s?.count || 0),
        truncated: Boolean(s?.truncated)
      });
      return;
    }
    prev.count += Number(s?.count || 0);
    prev.truncated = prev.truncated || Boolean(s?.truncated);
  });
  return [...map.values()];
}

function buildSystemPrompt() {
  const regrasEscola = String(STATE.memoryText || '').trim();
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, '0');
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const yyyy = hoje.getFullYear();

  return `Você é o Assistente Especialista em Dados do sistema de Reforço Escolar.
Sua missão é atuar como Analista Pedagógico, respondendo às perguntas do corpo docente com extrema clareza e cordialidade.
O dia de hoje é ${dd}/${mm}/${yyyy} (Mês ${hoje.getMonth() + 1}, Ano ${yyyy}).

REGRAS CRÍTICAS (RAG & ATERRAMENTO):
1. USE AS FERRAMENTAS (TOOLS). Se precisarem saber de alunos antigos, frequências, faltas ou histórico, acione as ferramentas disponíveis em vez de tentar adivinhar.
2. NUNCA ALUCINE DADOS. Se você buscou algo com a ferramenta e ela retornou vazio ou o aluno não existe, responda explicitamente: "Não encontrei dados suficientes no sistema."
3. NUNCA revele termos técnicos (como JSON, arrays, "usei a ferramenta"). Aja naturalmente como se tivesse buscado nos seus próprios arquivos do sistema interno.
4. FORMATE A RESPOSTA COMO CHAT ORGANIZADO: use títulos curtos, bullets e linguagem objetiva.
5. EM PERGUNTAS ANALÍTICAS, responda em 3 blocos:
   - "Resumo"
   - "Evidências nos dados"
   - "Próximas ações"
6. QUANDO A PERGUNTA FOR SOBRE PROFESSOR DE REFORÇO, use a ferramenta "tool_resumo_professor_reforco" para responder com números exatos.
7. QUANDO PEDIREM VISÃO AMPLA OU TOTALIZAÇÕES, use "tool_resumo_sistema" e/ou "tool_consultar_colecao".
8. Sempre priorize dados mais recentes e considere os registros que existirem no banco no momento da consulta.

DIRETRIZES DA ESCOLA (Instruções Personalizadas do Time de Gestão):
${regrasEscola || '(Sem diretrizes adicionais cadastradas.)'}`;
}

async function callOpenAI({ apiKey, model, messages, tools = null, toolChoice = null }) {
  const payload = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature: 0.2
  };
  if (tools && Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = toolChoice || 'auto';
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = data?.error?.message || `Erro HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data;
}

function persistKeyAndModel() {
  sessionStorage.setItem(OPENAI_MODEL_STORAGE, STATE.model);
  localStorage.setItem(OPENAI_MODEL_STORAGE, STATE.model);

  if (STATE.apiKey) {
    sessionStorage.setItem(OPENAI_KEY_STORAGE, STATE.apiKey);
    if (STATE.rememberKey) {
      localStorage.setItem(OPENAI_KEY_STORAGE, STATE.apiKey);
    } else {
      localStorage.removeItem(OPENAI_KEY_STORAGE);
    }
  } else {
    sessionStorage.removeItem(OPENAI_KEY_STORAGE);
    localStorage.removeItem(OPENAI_KEY_STORAGE);
  }
}

function chatMessagesHTML() {
  if (!STATE.messages.length) {
    return `
      <div class="text-center text-gray-400 py-10">
        <p class="text-xs font-bold uppercase tracking-wider">Sem conversa ainda.</p>
        <p class="text-xs font-bold mt-1">Faça uma pergunta ou use um atalho acima.</p>
      </div>
    `;
  }

  const items = STATE.messages.map((m) => {
    const isUser = m.role === 'user';
    const horario = formatMessageTime(m.createdAt);
    const body = isUser
      ? `<p class="whitespace-pre-wrap font-bold text-sm">${escapeHtml(m.content || '')}</p>`
      : renderAssistantMessage(m.content || '');
    const sources = !isUser ? renderSourcesBadge(m.sources) : '';

    return `
      <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[96%] md:max-w-[82%] border-2 border-black px-3 py-2 ${isUser ? 'bg-blue-500 text-white' : 'bg-white text-black'}">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-[10px] font-black uppercase tracking-wider ${isUser ? 'text-blue-100' : 'text-gray-500'}">${isUser ? 'Você' : 'IA Tutor'}</span>
            <span class="text-[10px] font-black ${isUser ? 'text-blue-100' : 'text-gray-400'}">${horario}</span>
          </div>
          ${body}
          ${sources}
        </div>
      </div>
    `;
  }).join('');

  if (STATE.busy) {
    return `${items}
      <div class="flex justify-start">
        <div class="max-w-[70%] border-2 border-black px-3 py-2 bg-white text-black">
          <div class="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">IA Tutor</div>
          <p class="text-sm font-bold text-gray-600 animate-pulse">Consultando dados e organizando resposta...</p>
        </div>
      </div>
    `;
  }

  return items;
}

function renderAssistantMessage(content) {
  const safe = escapeHtml(content || '');
  const lines = safe.split(/\r?\n/);
  let html = '';
  let inUl = false;
  let inOl = false;

  function closeLists() {
    if (inUl) html += '</ul>';
    if (inOl) html += '</ol>';
    inUl = false;
    inOl = false;
  }

  for (const rawLine of lines) {
    const line = String(rawLine || '');
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      html += '<div class="h-2"></div>';
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (inOl) {
        html += '</ol>';
        inOl = false;
      }
      if (!inUl) {
        html += '<ul class="list-disc pl-5 space-y-1 text-sm">';
        inUl = true;
      }
      html += `<li class="font-semibold">${formatInlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</li>`;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        html += '</ul>';
        inUl = false;
      }
      if (!inOl) {
        html += '<ol class="list-decimal pl-5 space-y-1 text-sm">';
        inOl = true;
      }
      html += `<li class="font-semibold">${formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</li>`;
      continue;
    }

    closeLists();
    if (/^#{1,3}\s+/.test(trimmed)) {
      html += `<p class="text-sm font-black uppercase tracking-wider mt-1">${formatInlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ''))}</p>`;
      continue;
    }

    html += `<p class="text-sm font-semibold">${formatInlineMarkdown(trimmed)}</p>`;
  }

  closeLists();
  return html;
}

function formatInlineMarkdown(text) {
  let out = String(text || '');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 border border-black bg-gray-100 text-[11px]">$1</code>');
  return out;
}

function renderSourcesBadge(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return '';
  return `
    <div class="mt-2 border-t border-black pt-2">
      <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Dados usados nesta resposta</p>
      <div class="flex flex-wrap gap-1">
        ${sources.map((s) => `
          <span class="text-[10px] font-black border border-black px-1.5 py-0.5 ${s?.truncated ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}">
            ${escapeHtml(s?.label || 'Dados')} • ${Number(s?.count || 0)}${s?.truncated ? '+' : ''}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function formatMessageTime(ts) {
  const value = Number(ts || Date.now());
  const d = new Date(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function modelOptionsHTML(selected) {
  const options = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'];
  return options.map((m) => `<option value="${m}" ${m === selected ? 'selected' : ''}>${m}</option>`).join('');
}

function scrollChatToBottom(container) {
  const box = container.querySelector('#ia-chat-box');
  if (box) box.scrollTop = box.scrollHeight;
}

function normalizeErrorMessage(err) {
  const raw = String(err?.message || err || 'Erro desconhecido');
  if (raw.toLowerCase().includes('failed to fetch')) {
    return 'Falha de conexão com a API da OpenAI. Verifique internet, chave e permissões de rede/CORS.';
  }
  return raw;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, ' ');
}
