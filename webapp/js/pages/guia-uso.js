/**
 * 📘 GUIA E TUTORIAL — Coordenação e Professores
 * Explica como as análises são calculadas e faz diagnóstico de prontidão dos dados.
 */

import { isFirebaseConfigured } from '../firebase-config.js';
import {
  getEscolaContext,
  listarEscolas,
  listarCoordenadores,
  listarTurmas,
  listarEstudantes,
  listarProfsReforco,
  listarProfsRegentes,
  listarRegistrosDiariosTodos,
  listarConsolidadosMensais,
  listarEncaminhamentos,
  compreensaoParaNota
} from '../db.js';

const ANALISES_GUIA = [
  {
    titulo: 'Faltas e Risco',
    campos: 'compareceu, motivo_falta, estudante, turma, professor, data_registro',
    calculos: [
      'Frequência geral = presenças / total de registros.',
      'Aluno em risco = faltas >= 2 e percentual de falta >= 30% no recorte.',
      'Motivo recorrente = motivo_falta mais frequente por aluno.'
    ],
    uso: 'Priorizar busca ativa para alunos com reincidência e atacar o motivo principal da ausência.'
  },
  {
    titulo: 'Gargalos de Habilidade',
    campos: 'habilidade_trabalhada, dificuldade_latente, nivel_compreensao, compareceu',
    calculos: [
      'Nota de compreensão: nível textual convertido para escala 1 a 4.',
      'Baixa compreensão: registros com nota <= 2.',
      'Risco da habilidade = (100 - média%) x 0.5 + dificuldade% x 0.3 + baixa compreensão% x 0.2.'
    ],
    uso: 'Replanejar a habilidade com maior risco e revisar estratégia de mediação em pequenos grupos.'
  },
  {
    titulo: 'Comportamento e Participação',
    campos: 'estado_emocional, participacao, estudante, data_registro',
    calculos: [
      'Somente presenças entram na análise.',
      'Sinal de atenção: estados críticos (triste, irritado, ansioso, eufórico) e/ou engajamento crítico.',
      'Índice por aluno = (eventos emocionais x 2) + eventos de engajamento.'
    ],
    uso: 'Acionar acompanhamento mais próximo para quem mantém sinais repetidos por vários atendimentos.'
  },
  {
    titulo: 'Efetividade de Intervenção',
    campos: 'tipo_atividade, origem_conteudo, nivel_compreensao, data_registro, estudante',
    calculos: [
      'Agrupa por tipo_atividade, origem_conteudo e combinação dos dois.',
      'Ganho por aluno = última nota - primeira nota (na mesma categoria).',
      'Ganho médio e taxa positiva mostram quais intervenções geram mais evolução.'
    ],
    uso: 'Padronizar as intervenções com ganho positivo e revisar as que aparecem com ganho <= 0.'
  },
  {
    titulo: 'Fechamento Bimestral',
    campos: 'parecer_evolutivo, recomendacao_alta, acao_pedagogica, bimestre, data_registro',
    calculos: [
      'Distribui pareceres por turma e por professor.',
      'Taxa de alta = recomendacao_alta verdadeira / total de fechamentos.',
      'Prioridade = casos estagnados ou sem ação pedagógica preenchida.'
    ],
    uso: 'Usar o fechamento para reunião pedagógica e plano de ação da turma seguinte.'
  },
  {
    titulo: 'Consolidado Quantitativo Automático',
    campos: 'notas por habilidade (port/mat + avançado anos finais), estudante, bimestre, data_registro',
    calculos: [
      'Atingiram metas: média >= 7.0.',
      'Em processo: média entre 4.0 e 6.9.',
      'Defasagem: média < 4.0.',
      'Exibe quantidade e percentual por categoria em Português e Matemática.'
    ],
    uso: 'Apoiar reunião pedagógica com visão objetiva de quem avançou, quem está em processo e quem precisa de intervenção imediata.'
  },
  {
    titulo: 'Fluxo de Encaminhamentos',
    campos: 'status, data_solicitacao, data_conclusao, alvo_area, regente_id',
    calculos: [
      'Funil por status: PENDENTE, ATENDIDO_PELO_REFORCO, LIDO_PELO_REGENTE.',
      'Tempo de resposta = data_conclusao - data_solicitacao (dias).',
      'Pendência crítica = encaminhamento pendente com idade >= 7 dias.'
    ],
    uso: 'Atacar backlog por área e reduzir tempo médio de resposta para evitar atraso pedagógico.'
  }
];

const ROTINA_ACAO = {
  reforco: [
    'Antes da aula: revise no painel quem faltou e quem está com baixa compreensão.',
    'Durante a aula: registre habilidade, tipo de atividade, estado emocional e participação.',
    'No fechamento mensal: confira o consolidado quantitativo automático para validar seu parecer.',
    'Fim da aula: em casos críticos, encaminhe o regente no mesmo dia.',
    'Semanal: repita intervenções que tiveram ganho positivo no painel de efetividade.'
  ],
  regente: [
    'Semanal: consulte evolução da turma e leia encaminhamentos recebidos.',
    'Em sala: aplique a ação pedagógica sugerida no fechamento bimestral.',
    'Em casos de alerta: alinhe com reforço para ajustar foco de habilidade.',
    'Bimestral: confirme quais estudantes podem sair ou permanecer no reforço.'
  ],
  coordenacao: [
    'Segunda: abrir painel de faltas para busca ativa dos reincidentes.',
    'Terça/Quarta: atacar habilidades críticas e estudantes com sinais socioemocionais.',
    'Quinta: revisar efetividade das intervenções por professor e por turma.',
    'Sexta: acompanhar fluxo de encaminhamentos e fechar prioridades pedagógicas.'
  ]
};

const PERFIL_LABEL = {
  reforco: 'Professor de Reforço',
  regente: 'Professor Regente',
  coordenacao: 'Coordenação',
  admin: 'Admin'
};

export async function renderGuiaUso(container, session) {
  if (!session?.perfil) {
    container.innerHTML = `<p class="text-red-500 font-bold p-4">Acesso restrito.</p>`;
    return;
  }

  let diagnostico = null;
  let erro = '';

  container.innerHTML = loadingHTML();
  await carregarDiagnostico();
  renderPage();

  async function carregarDiagnostico() {
    erro = '';
    try {
      diagnostico = await gerarDiagnostico(session);
    } catch (e) {
      console.error('Erro ao gerar diagnóstico do guia:', e);
      erro = 'Não foi possível calcular a prontidão agora. Tente atualizar.';
      diagnostico = null;
    }
  }

  function renderPage() {
    const resumo = diagnostico?.resumo || resumoFallback();
    const rotina = montarRotina(session.perfil);
    const blocoQualidadeDiaria = diagnostico ? renderQualidadeDiaria(diagnostico.diario) : renderSemDados();
    const blocoQualidadeMensal = diagnostico ? renderQualidadeMensal(diagnostico.mensal) : renderSemDados();
    const blocoChecks = diagnostico ? renderChecklist(diagnostico.checks) : renderSemDados();

    container.innerHTML = `
      <div class="animate-fade-in space-y-6">
        <div class="border-b-4 border-black pb-4">
          <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Guia e Tutorial</h2>
          <p class="text-gray-500 font-bold text-sm mt-1">Como as análises funcionam, como estudar melhor e diagnóstico real de prontidão.</p>
        </div>

        <div class="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p class="text-[10px] font-black uppercase tracking-wider text-gray-500">Status da Plataforma</p>
              <p class="text-lg font-black ${resumo.corTexto}">${resumo.titulo}</p>
              <p class="text-xs font-bold text-gray-600 mt-1">${resumo.descricao}</p>
              <p class="text-[10px] font-bold text-gray-500 mt-1">
                Perfil atual: ${esc(PERFIL_LABEL[session.perfil] || session.perfil)} • Escola: ${esc(diagnostico?.escolaNome || session.escolaNome || 'Não definida')}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button id="btn-guia-exportar" class="bg-white border-2 border-black text-black px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-70">
                <i data-lucide="file-down" class="w-4 h-4"></i> Exportar Diagnóstico (PDF)
              </button>
              <button id="btn-guia-atualizar" class="bg-black border-2 border-black text-white px-4 py-2 font-black uppercase tracking-wider text-xs btn-brutal shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-70">
                <i data-lucide="refresh-ccw" class="w-4 h-4"></i> Atualizar Diagnóstico
              </button>
            </div>
          </div>
          ${erro ? `<p class="text-xs font-black text-red-700 mt-2">${esc(erro)}</p>` : ''}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${metricCard('Escolas', diagnostico?.contagens?.escolas ?? '—', 'school', 'blue')}
          ${metricCard('Turmas', diagnostico?.contagens?.turmas ?? '—', 'building-2', 'indigo')}
          ${metricCard('Estudantes', diagnostico?.contagens?.estudantes ?? '—', 'users', 'green')}
          ${metricCard('Registros Diários', diagnostico?.contagens?.registrosDiarios ?? '—', 'clipboard-list', 'amber')}
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Como Cada Análise é Calculada</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${ANALISES_GUIA.map((item) => renderAnaliseCard(item)).join('')}
          </div>
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Campos Das Perguntas Usados Pelas Análises</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="border-2 border-black bg-gray-50 p-3">
              <p class="text-[11px] font-black uppercase tracking-wider">Ficha Diária</p>
              <p class="text-[11px] font-bold text-gray-700 mt-1">compareceu, motivo_falta, habilidade_trabalhada, dificuldade_latente, nivel_compreensao, tipo_atividade, origem_conteudo, estado_emocional, participacao.</p>
            </div>
            <div class="border-2 border-black bg-gray-50 p-3">
              <p class="text-[11px] font-black uppercase tracking-wider">Fechamento Bimestral</p>
              <p class="text-[11px] font-bold text-gray-700 mt-1">parecer_evolutivo, recomendacao_alta, acao_pedagogica, nível inicial (leitura/escrita), status final, observações pedagógicas, ciente do regente, frequência do bimestre e notas de habilidade por área.</p>
            </div>
          </div>
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Como Funciona o Consolidado Quantitativo Automático</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="border-2 border-black bg-green-50 p-3">
              <p class="text-[11px] font-black uppercase tracking-wider text-green-800">Atingiram as metas</p>
              <p class="text-[11px] font-bold text-green-900 mt-1">Média final por disciplina maior ou igual a <b>7.0</b>.</p>
            </div>
            <div class="border-2 border-black bg-yellow-50 p-3">
              <p class="text-[11px] font-black uppercase tracking-wider text-yellow-800">Em processo</p>
              <p class="text-[11px] font-bold text-yellow-900 mt-1">Média final por disciplina entre <b>4.0 e 6.9</b>.</p>
            </div>
            <div class="border-2 border-black bg-red-50 p-3">
              <p class="text-[11px] font-black uppercase tracking-wider text-red-800">Defasagem</p>
              <p class="text-[11px] font-bold text-red-900 mt-1">Média final por disciplina menor que <b>4.0</b>.</p>
            </div>
          </div>
          <p class="text-[11px] font-bold text-gray-700 mt-3">
            O sistema calcula isso automaticamente por <b>Português</b> e <b>Matemática</b>, com quantidade e percentual por categoria, seguindo o quadro 3 das fichas físicas.
          </p>
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Rotina Prática Para Evolução dos Estudantes</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${rotina.map((bloco) => `
              <div class="border-2 border-black bg-gray-50 p-3">
                <p class="text-[11px] font-black uppercase tracking-wider mb-2">${esc(bloco.titulo)}</p>
                <div class="space-y-1.5">
                  ${bloco.itens.map((item) => `<p class="text-[11px] font-bold text-gray-700">• ${esc(item)}</p>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Qualidade dos Dados - Diário</h3>
            ${blocoQualidadeDiaria}
          </div>
          <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Qualidade dos Dados - Bimestral e Fluxo</h3>
            ${blocoQualidadeMensal}
          </div>
        </div>

        <div class="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 class="text-xs font-black uppercase tracking-wider border-b-2 border-black pb-2 mb-4">Checklist de Prontidão Para Uso na Escola</h3>
          ${blocoChecks}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    attachEvents();
  }

  function attachEvents() {
    const btnAtualizar = container.querySelector('#btn-guia-atualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', async () => {
        btnAtualizar.disabled = true;
        btnAtualizar.innerHTML = 'Atualizando...';
        await carregarDiagnostico();
        renderPage();
      });
    }

    const btnExportar = container.querySelector('#btn-guia-exportar');
    if (btnExportar) {
      btnExportar.addEventListener('click', () => {
        if (!diagnostico) {
          alert('Diagnóstico ainda não carregado. Atualize e tente novamente.');
          return;
        }
        exportarDiagnosticoPDF(diagnostico, session);
      });
    }
  }
}

async function gerarDiagnostico(session) {
  const contexto = getEscolaContext();
  const escolaIdAlvo = String(session?.escolaId || contexto?.escolaId || '').trim();

  const [
    escolas,
    turmas,
    estudantes,
    profsReforco,
    profsRegentes,
    registrosDiarios,
    consolidados,
    encaminhamentos,
    coordenadores
  ] = await Promise.all([
    listarEscolas(),
    listarTurmas(),
    listarEstudantes(null, true),
    listarProfsReforco(),
    listarProfsRegentes(),
    listarRegistrosDiariosTodos(),
    listarConsolidadosMensais(),
    listarEncaminhamentos(),
    escolaIdAlvo ? listarCoordenadores(escolaIdAlvo) : listarCoordenadores()
  ]);

  const diario = analisarDadosDiarios(registrosDiarios || []);
  const mensal = analisarDadosMensais(consolidados || [], encaminhamentos || []);

  const checks = montarChecklist({
    firebaseOk: isFirebaseConfigured(),
    escolas: escolas || [],
    coordenadores: coordenadores || [],
    turmas: turmas || [],
    estudantes: estudantes || [],
    profsReforco: profsReforco || [],
    profsRegentes: profsRegentes || [],
    registrosDiarios: registrosDiarios || [],
    consolidados: consolidados || [],
    diario,
    mensal
  });

  const resumo = resumirProntidao(checks);

  return {
    escolaNome: descobrirNomeEscola(session, contexto, escolas || []),
    contagens: {
      escolas: (escolas || []).length,
      coordenadores: (coordenadores || []).length,
      turmas: (turmas || []).length,
      estudantes: (estudantes || []).length,
      profsReforco: (profsReforco || []).length,
      profsRegentes: (profsRegentes || []).length,
      registrosDiarios: (registrosDiarios || []).length,
      consolidados: (consolidados || []).length,
      encaminhamentos: (encaminhamentos || []).length
    },
    diario,
    mensal,
    checks,
    resumo
  };
}

function montarChecklist(ctx) {
  const diarioCompleto = ctx.diario.coberturaCritica >= 70;
  const mensalCompleto = ctx.mensal.coberturaCritica >= 70;
  const quantAutomaticoOk = ctx.mensal.pAutoQuant >= 70;

  return [
    {
      label: 'Conexão do sistema',
      detalhe: ctx.firebaseOk ? 'Firebase configurado e ativo.' : 'Firebase não configurado (modo limitado).',
      ok: ctx.firebaseOk,
      obrigatorio: true
    },
    {
      label: 'Escolas cadastradas',
      detalhe: `${ctx.escolas.length} escola(s).`,
      ok: ctx.escolas.length > 0,
      obrigatorio: true
    },
    {
      label: 'Coordenação cadastrada',
      detalhe: `${ctx.coordenadores.length} coordenador(es) na escola.`,
      ok: ctx.coordenadores.length > 0,
      obrigatorio: true
    },
    {
      label: 'Turmas cadastradas',
      detalhe: `${ctx.turmas.length} turma(s).`,
      ok: ctx.turmas.length > 0,
      obrigatorio: true
    },
    {
      label: 'Professores de reforço',
      detalhe: `${ctx.profsReforco.length} professor(es).`,
      ok: ctx.profsReforco.length > 0,
      obrigatorio: true
    },
    {
      label: 'Professores regentes',
      detalhe: `${ctx.profsRegentes.length} professor(es).`,
      ok: ctx.profsRegentes.length > 0,
      obrigatorio: true
    },
    {
      label: 'Estudantes cadastrados',
      detalhe: `${ctx.estudantes.length} estudante(s).`,
      ok: ctx.estudantes.length > 0,
      obrigatorio: true
    },
    {
      label: 'Registros diários lançados',
      detalhe: `${ctx.registrosDiarios.length} registro(s).`,
      ok: ctx.registrosDiarios.length > 0,
      obrigatorio: false
    },
    {
      label: 'Qualidade dos campos diários',
      detalhe: `Cobertura crítica: ${ctx.diario.coberturaCritica}%`,
      ok: diarioCompleto,
      obrigatorio: false
    },
    {
      label: 'Fechamento bimestral lançado',
      detalhe: `${ctx.consolidados.length} fechamento(s).`,
      ok: ctx.consolidados.length > 0,
      obrigatorio: false
    },
    {
      label: 'Qualidade dos campos bimestrais',
      detalhe: `Cobertura crítica: ${ctx.mensal.coberturaCritica}%`,
      ok: mensalCompleto,
      obrigatorio: false
    },
    {
      label: 'Consolidado quantitativo automático',
      detalhe: `Base com notas válidas para classificação: ${ctx.mensal.pAutoQuant}%`,
      ok: quantAutomaticoOk,
      obrigatorio: false
    }
  ];
}

function resumirProntidao(checks) {
  const obrigatorios = checks.filter((c) => c.obrigatorio);
  const opcionais = checks.filter((c) => !c.obrigatorio);
  const okObrig = obrigatorios.filter((c) => c.ok).length;
  const okOpc = opcionais.filter((c) => c.ok).length;

  if (okObrig < obrigatorios.length) {
    return {
      titulo: 'Cadastro Inicial Pendente',
      descricao: 'Finalize itens obrigatórios para operar com segurança entre coordenação e professores.',
      corTexto: 'text-red-700'
    };
  }

  if (okOpc >= Math.ceil(opcionais.length * 0.6)) {
    return {
      titulo: 'Plataforma Pronta Para Uso',
      descricao: 'A estrutura está pronta e os dados já permitem acompanhar evolução dos estudantes.',
      corTexto: 'text-green-700'
    };
  }

  return {
    titulo: 'Pronta, Com Ajustes de Qualidade',
    descricao: 'A operação pode iniciar, mas é importante aumentar preenchimento dos campos pedagógicos.',
    corTexto: 'text-amber-700'
  };
}

function analisarDadosDiarios(registros) {
  const presentes = registros.filter((r) => isPresent(r));
  const faltas = registros.filter((r) => !isPresent(r));

  const hab = countFilled(presentes, (r) => r.habilidade_trabalhada);
  const comp = countFilled(presentes, (r) => compreensaoParaNota(r.nivel_compreensao ?? 0) > 0);
  const part = countFilled(presentes, (r) => r.participacao);
  const emo = countFilled(presentes, (r) => r.estado_emocional);
  const tipo = countFilled(presentes, (r) => r.tipo_atividade);
  const origem = countFilled(presentes, (r) => r.origem_conteudo);
  const motivoFalta = countFilled(faltas, (r) => r.motivo_falta);

  const pHab = pct(hab, presentes.length);
  const pComp = pct(comp, presentes.length);
  const pPart = pct(part, presentes.length);
  const pEmo = pct(emo, presentes.length);
  const pTipo = pct(tipo, presentes.length);
  const pOrigem = pct(origem, presentes.length);
  const pMotivo = faltas.length > 0 ? pct(motivoFalta, faltas.length) : 100;
  const metricasPresenca = presentes.length > 0 ? [pHab, pComp, pPart, pEmo, pTipo, pOrigem] : [];
  const metricasCriticas = [];
  if (presentes.length > 0) metricasCriticas.push(pHab, pComp, pPart);
  if (faltas.length > 0) metricasCriticas.push(pMotivo);
  const coberturaPresenca = metricasPresenca.length > 0 ? media(metricasPresenca) : 0;
  const coberturaCritica = metricasCriticas.length > 0 ? media(metricasCriticas) : 0;

  return {
    total: registros.length,
    presentes: presentes.length,
    faltas: faltas.length,
    coberturaPresenca,
    coberturaCritica,
    pHab,
    pComp,
    pPart,
    pEmo,
    pTipo,
    pOrigem,
    pMotivo
  };
}

function analisarDadosMensais(consolidados, encaminhamentos) {
  const notas = countFilled(consolidados, hasAnyNotaBimestral);
  const autoQuant = countFilled(consolidados, hasAnyNotaBimestral);
  const parecer = countFilled(consolidados, (r) => r.parecer_evolutivo);
  const acao = countFilled(consolidados, (r) => r.acao_pedagogica);
  const statusFinal = countFilled(consolidados, (r) => r.status_final_consolidado);
  const obsPedagogica = countFilled(consolidados, (r) => r.observacoes_pedagogicas);
  const nivelInicial = countFilled(consolidados, (r) => r.nivel_inicial_escrita || r.nivel_inicial_leitura);
  const regenteCiente = countFilled(consolidados, (r) => r.regente_ciente_frequencia === true || r.regente_ciente_frequencia === 1);
  const freqSnapshot = countFilled(consolidados, hasFreqSnapshot);
  const alta = countFilled(consolidados, (r) => typeof r.recomendacao_alta === 'boolean' || r.recomendacao_alta === 0 || r.recomendacao_alta === 1);

  const pNotas = pct(notas, consolidados.length);
  const pAutoQuant = pct(autoQuant, consolidados.length);
  const pParecer = pct(parecer, consolidados.length);
  const pAcao = pct(acao, consolidados.length);
  const pStatusFinal = pct(statusFinal, consolidados.length);
  const pObsPedagogica = pct(obsPedagogica, consolidados.length);
  const pNivelInicial = pct(nivelInicial, consolidados.length);
  const pRegenteCiente = pct(regenteCiente, consolidados.length);
  const pFreqSnapshot = pct(freqSnapshot, consolidados.length);
  const pAlta = pct(alta, consolidados.length);
  const coberturaCritica = Math.round(media([pNotas, pParecer, pAcao, pStatusFinal, pRegenteCiente, pAutoQuant]));

  const statusCount = { pendente: 0, atendido: 0, lido: 0 };
  const temposResposta = [];

  encaminhamentos.forEach((e) => {
    const status = normalizaStatus(e.status);
    if (status === 'PENDENTE') statusCount.pendente += 1;
    if (status === 'ATENDIDO_PELO_REFORCO') statusCount.atendido += 1;
    if (status === 'LIDO_PELO_REGENTE') statusCount.lido += 1;

    const dias = calcDias(e.data_solicitacao, e.data_conclusao);
    if (dias !== null) temposResposta.push(dias);
  });

  const tempoMedio = temposResposta.length > 0
    ? Number((temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length).toFixed(1))
    : null;

  return {
    totalConsolidados: consolidados.length,
    pNotas,
    pAutoQuant,
    pParecer,
    pAcao,
    pStatusFinal,
    pObsPedagogica,
    pNivelInicial,
    pRegenteCiente,
    pFreqSnapshot,
    pAlta,
    coberturaCritica,
    totalEncaminhamentos: encaminhamentos.length,
    pendente: statusCount.pendente,
    atendido: statusCount.atendido,
    lido: statusCount.lido,
    tempoMedio
  };
}

function descobrirNomeEscola(session, contexto, escolas) {
  if (session?.escolaNome) return session.escolaNome;
  if (contexto?.escolaNome) return contexto.escolaNome;
  const id = String(session?.escolaId || contexto?.escolaId || '').trim();
  if (!id) return 'Não definida';
  const esc = (escolas || []).find((e) => String(e.id) === id);
  return esc?.nome || 'Não definida';
}

function montarRotina(perfil) {
  const base = [
    { titulo: 'Coordenação', itens: ROTINA_ACAO.coordenacao },
    { titulo: 'Professor de Reforço', itens: ROTINA_ACAO.reforco },
    { titulo: 'Professor Regente', itens: ROTINA_ACAO.regente }
  ];

  if (perfil === 'coordenacao') return base;
  if (perfil === 'reforco') return [base[1], base[2], base[0]];
  if (perfil === 'regente') return [base[2], base[1], base[0]];
  return base;
}

function exportarDiagnosticoPDF(diagnostico, session) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) {
    alert('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-up.');
    return;
  }

  const resumoExec = montarResumoExecutivo(diagnostico);
  const dataGeracao = formatDateTimeBR(new Date());
  const perfilAtual = PERFIL_LABEL[session?.perfil] || String(session?.perfil || 'Usuário');
  const html = buildHtmlRelatorioPdf(diagnostico, resumoExec, perfilAtual, dataGeracao);

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function montarResumoExecutivo(diagnostico) {
  const checklist = diagnostico?.checks || [];
  const fortes = checklist.filter((c) => c.ok).map((c) => c.label);
  const prioridades = checklist
    .filter((c) => !c.ok)
    .map((c) => `${c.label}: ${c.detalhe}`);

  return {
    fortes,
    prioridades,
    totalItens: checklist.length,
    okItens: fortes.length
  };
}

function buildHtmlRelatorioPdf(diagnostico, resumoExec, perfilAtual, dataGeracao) {
  const resumo = diagnostico?.resumo || resumoFallback();
  const escolaNome = diagnostico?.escolaNome || 'Não definida';
  const d = diagnostico?.diario || {};
  const m = diagnostico?.mensal || {};
  const checks = diagnostico?.checks || [];
  const cont = diagnostico?.contagens || {};

  const linhasChecklist = checks.map((item) => `
    <tr>
      <td>${esc(item.label)}</td>
      <td>${esc(item.detalhe)}</td>
      <td><span class="chip ${item.ok ? 'ok' : 'warn'}">${item.ok ? 'OK' : 'AJUSTAR'}</span></td>
      <td>${item.obrigatorio ? 'Obrigatório' : 'Recomendado'}</td>
    </tr>
  `).join('');

  const pontosFortes = resumoExec.fortes.length > 0
    ? resumoExec.fortes.map((txt) => `<li>${esc(txt)}</li>`).join('')
    : '<li>Sem pontos fortes identificados no momento.</li>';

  const prioridades = resumoExec.prioridades.length > 0
    ? resumoExec.prioridades.map((txt) => `<li>${esc(txt)}</li>`).join('')
    : '<li>Sem pendências críticas.</li>';

  const analises = ANALISES_GUIA.map((a) => `
    <tr>
      <td>${esc(a.titulo)}</td>
      <td>${esc(a.campos)}</td>
      <td>${esc(a.uso)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Diagnóstico da Plataforma - ${esc(escolaNome)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Arial", "Helvetica", sans-serif;
      color: #111827;
      background: #ffffff;
      line-height: 1.35;
      font-size: 12px;
    }
    .page {
      max-width: 980px;
      margin: 0 auto;
      padding: 16px;
    }
    .head {
      border: 2px solid #111827;
      padding: 12px;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    h2 {
      margin: 14px 0 6px 0;
      font-size: 13px;
      text-transform: uppercase;
      border-bottom: 2px solid #111827;
      padding-bottom: 4px;
      letter-spacing: 0.04em;
    }
    p.meta {
      margin: 3px 0;
      font-size: 11px;
      color: #374151;
      font-weight: 700;
    }
    .status {
      margin-top: 8px;
      border: 1px solid #111827;
      padding: 8px;
      background: #f9fafb;
    }
    .status strong { font-size: 13px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 10px 0 2px 0;
    }
    .card {
      border: 1px solid #111827;
      padding: 8px;
      background: #ffffff;
    }
    .card .k {
      margin: 0;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #6b7280;
    }
    .card .v {
      margin: 4px 0 0 0;
      font-size: 18px;
      font-weight: 900;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 6px;
      font-size: 11px;
      vertical-align: top;
    }
    th {
      background: #111827;
      color: #ffffff;
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    ul {
      margin: 6px 0;
      padding-left: 18px;
    }
    li {
      margin: 3px 0;
      font-size: 11px;
      font-weight: 700;
      color: #374151;
    }
    .grid-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .box {
      border: 1px solid #111827;
      padding: 8px;
      background: #f9fafb;
    }
    .chip {
      display: inline-block;
      border: 1px solid #111827;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.03em;
    }
    .ok { background: #dcfce7; color: #166534; }
    .warn { background: #fee2e2; color: #991b1b; }
    .foot {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px dashed #9ca3af;
      font-size: 10px;
      color: #6b7280;
      font-weight: 700;
    }
    .no-print {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .btn {
      border: 1px solid #111827;
      background: #111827;
      color: #fff;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }
    .btn.alt {
      background: #ffffff;
      color: #111827;
    }
    @media print {
      .no-print { display: none !important; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print">
      <button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
      <button class="btn alt" onclick="window.close()">Fechar</button>
    </div>

    <div class="head">
      <h1>Diagnóstico de Prontidão da Plataforma</h1>
      <p class="meta">Escola: ${esc(escolaNome)}</p>
      <p class="meta">Perfil que gerou: ${esc(perfilAtual)}</p>
      <p class="meta">Gerado em: ${esc(dataGeracao)}</p>
      <div class="status">
        <strong>${esc(resumo.titulo)}</strong>
        <p style="margin:4px 0 0 0; font-size:11px; font-weight:700; color:#374151;">${esc(resumo.descricao)}</p>
      </div>
    </div>

    <div class="cards">
      <div class="card"><p class="k">Escolas</p><p class="v">${cont.escolas ?? 0}</p></div>
      <div class="card"><p class="k">Turmas</p><p class="v">${cont.turmas ?? 0}</p></div>
      <div class="card"><p class="k">Estudantes</p><p class="v">${cont.estudantes ?? 0}</p></div>
      <div class="card"><p class="k">Registros Diários</p><p class="v">${cont.registrosDiarios ?? 0}</p></div>
    </div>

    <h2>Resumo Executivo</h2>
    <div class="grid-two">
      <div class="box">
        <p style="margin:0; font-size:11px; font-weight:900;">Indicadores-chave</p>
        <ul>
          <li>Checklist OK: ${resumoExec.okItens}/${resumoExec.totalItens}</li>
          <li>Cobertura crítica do diário: ${d.coberturaCritica ?? 0}%</li>
          <li>Cobertura crítica bimestral: ${m.coberturaCritica ?? 0}%</li>
          <li>Base do consolidado quantitativo automático: ${m.pAutoQuant ?? 0}%</li>
          <li>Tempo médio de resposta (fluxo): ${m.tempoMedio === null || m.tempoMedio === undefined ? 'N/D' : `${m.tempoMedio} dias`}</li>
        </ul>
      </div>
      <div class="box">
        <p style="margin:0; font-size:11px; font-weight:900;">Pendências imediatas</p>
        <ul>${prioridades}</ul>
      </div>
    </div>

    <h2>Pontos Fortes</h2>
    <div class="box">
      <ul>${pontosFortes}</ul>
    </div>

    <h2>Checklist de Prontidão</h2>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Detalhe</th>
          <th>Status</th>
          <th>Classificação</th>
        </tr>
      </thead>
      <tbody>
        ${linhasChecklist}
      </tbody>
    </table>

    <h2>Qualidade dos Dados Diários</h2>
    <table>
      <thead>
        <tr>
          <th>Métrica</th>
          <th>Cobertura</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Presenças com habilidade_trabalhada</td><td>${d.pHab ?? 0}%</td></tr>
        <tr><td>Presenças com nivel_compreensao</td><td>${d.pComp ?? 0}%</td></tr>
        <tr><td>Presenças com participação</td><td>${d.pPart ?? 0}%</td></tr>
        <tr><td>Presenças com estado_emocional</td><td>${d.pEmo ?? 0}%</td></tr>
        <tr><td>Presenças com tipo_atividade</td><td>${d.pTipo ?? 0}%</td></tr>
        <tr><td>Presenças com origem_conteudo</td><td>${d.pOrigem ?? 0}%</td></tr>
        <tr><td>Faltas com motivo_falta</td><td>${d.pMotivo ?? 0}%</td></tr>
        <tr><td><strong>Cobertura crítica</strong></td><td><strong>${d.coberturaCritica ?? 0}%</strong></td></tr>
      </tbody>
    </table>

    <h2>Qualidade Bimestral e Fluxo</h2>
    <table>
      <thead>
        <tr>
          <th>Métrica</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Consolidados com notas de habilidade</td><td>${m.pNotas ?? 0}%</td></tr>
        <tr><td>Base para consolidado quantitativo automático</td><td>${m.pAutoQuant ?? 0}%</td></tr>
        <tr><td>Consolidados com parecer_evolutivo</td><td>${m.pParecer ?? 0}%</td></tr>
        <tr><td>Consolidados com acao_pedagogica</td><td>${m.pAcao ?? 0}%</td></tr>
        <tr><td>Consolidados com status_final_consolidado</td><td>${m.pStatusFinal ?? 0}%</td></tr>
        <tr><td>Consolidados com observacoes_pedagogicas</td><td>${m.pObsPedagogica ?? 0}%</td></tr>
        <tr><td>Consolidados com nível inicial (leitura/escrita)</td><td>${m.pNivelInicial ?? 0}%</td></tr>
        <tr><td>Consolidados com ciente do regente</td><td>${m.pRegenteCiente ?? 0}%</td></tr>
        <tr><td>Consolidados com snapshot da frequência</td><td>${m.pFreqSnapshot ?? 0}%</td></tr>
        <tr><td>Consolidados com recomendacao_alta</td><td>${m.pAlta ?? 0}%</td></tr>
        <tr><td><strong>Cobertura crítica bimestral</strong></td><td><strong>${m.coberturaCritica ?? 0}%</strong></td></tr>
        <tr><td>Encaminhamentos pendentes</td><td>${m.pendente ?? 0}</td></tr>
        <tr><td>Encaminhamentos atendidos</td><td>${m.atendido ?? 0}</td></tr>
        <tr><td>Encaminhamentos lidos</td><td>${m.lido ?? 0}</td></tr>
        <tr><td>Tempo médio de resposta</td><td>${m.tempoMedio === null || m.tempoMedio === undefined ? 'N/D' : `${m.tempoMedio} dias`}</td></tr>
      </tbody>
    </table>

    <h2>Mapa Das Análises Disponíveis</h2>
    <table>
      <thead>
        <tr>
          <th>Análise</th>
          <th>Campos principais</th>
          <th>Uso pedagógico direto</th>
        </tr>
      </thead>
      <tbody>
        ${analises}
      </tbody>
    </table>

    <div class="foot">
      Relatório emitido automaticamente pelo menu Guia e Tutorial. Ao imprimir, selecione "Salvar como PDF".
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;
}

function renderAnaliseCard(item) {
  return `
    <div class="border-2 border-black bg-gray-50 p-3">
      <p class="text-[11px] font-black uppercase tracking-wider">${esc(item.titulo)}</p>
      <p class="text-[10px] font-bold text-gray-500 mt-1"><span class="text-black">Campos:</span> ${esc(item.campos)}</p>
      <div class="mt-2 space-y-1">
        ${item.calculos.map((calc) => `<p class="text-[10px] font-bold text-gray-700">• ${esc(calc)}</p>`).join('')}
      </div>
      <p class="text-[10px] font-bold text-blue-700 mt-2">Ação prática: ${esc(item.uso)}</p>
    </div>
  `;
}

function renderQualidadeDiaria(diario) {
  return `
    <div class="space-y-2">
      ${linhaQualidade('Presenças com habilidade_trabalhada', diario.pHab)}
      ${linhaQualidade('Presenças com nivel_compreensao', diario.pComp)}
      ${linhaQualidade('Presenças com participação', diario.pPart)}
      ${linhaQualidade('Presenças com estado_emocional', diario.pEmo)}
      ${linhaQualidade('Presenças com tipo_atividade', diario.pTipo)}
      ${linhaQualidade('Presenças com origem_conteudo', diario.pOrigem)}
      ${linhaQualidade('Faltas com motivo_falta', diario.pMotivo)}
      <div class="pt-2 border-t border-black">
        <p class="text-[11px] font-black">Cobertura crítica: <span class="${statusColor(diario.coberturaCritica)}">${diario.coberturaCritica}%</span></p>
        <p class="text-[10px] font-bold text-gray-600 mt-1">Total: ${diario.total} registros • ${diario.presentes} presenças • ${diario.faltas} faltas</p>
      </div>
    </div>
  `;
}

function renderQualidadeMensal(mensal) {
  return `
    <div class="space-y-2">
      ${linhaQualidade('Consolidados com notas de habilidade', mensal.pNotas)}
      ${linhaQualidade('Base para consolidado quantitativo automático', mensal.pAutoQuant)}
      ${linhaQualidade('Consolidados com parecer_evolutivo', mensal.pParecer)}
      ${linhaQualidade('Consolidados com acao_pedagogica', mensal.pAcao)}
      ${linhaQualidade('Consolidados com status_final_consolidado', mensal.pStatusFinal)}
      ${linhaQualidade('Consolidados com observacoes_pedagogicas', mensal.pObsPedagogica)}
      ${linhaQualidade('Consolidados com nivel inicial (leitura/escrita)', mensal.pNivelInicial)}
      ${linhaQualidade('Consolidados com ciente do regente', mensal.pRegenteCiente)}
      ${linhaQualidade('Consolidados com snapshot da frequência', mensal.pFreqSnapshot)}
      ${linhaQualidade('Consolidados com recomendacao_alta', mensal.pAlta)}
      <div class="pt-2 border-t border-black">
        <p class="text-[11px] font-black">Cobertura crítica: <span class="${statusColor(mensal.coberturaCritica)}">${mensal.coberturaCritica}%</span></p>
        <p class="text-[10px] font-bold text-gray-600 mt-1">Consolidados: ${mensal.totalConsolidados}</p>
      </div>
      <div class="pt-2 border-t border-black">
        <p class="text-[11px] font-black">Fluxo de encaminhamentos</p>
        <p class="text-[10px] font-bold text-gray-600 mt-1">Pendentes: ${mensal.pendente} • Atendidos: ${mensal.atendido} • Lidos: ${mensal.lido}</p>
        <p class="text-[10px] font-bold text-gray-600">Tempo médio de resposta: ${mensal.tempoMedio === null ? 'N/D' : `${mensal.tempoMedio} dias`}</p>
      </div>
    </div>
  `;
}

function renderChecklist(checks) {
  return `
    <div class="space-y-2">
      ${checks.map((item) => `
        <div class="border border-black p-2 ${item.ok ? 'bg-green-50' : 'bg-red-50'}">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-black">${esc(item.label)}</p>
            <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${item.ok ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}">
              ${item.ok ? 'OK' : 'Ajustar'}
            </span>
          </div>
          <p class="text-[10px] font-bold text-gray-700 mt-1">${esc(item.detalhe)}${item.obrigatorio ? ' (obrigatório)' : ' (recomendado)'}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function linhaQualidade(label, valor) {
  return `
    <div class="flex items-center justify-between gap-3">
      <p class="text-[10px] font-bold text-gray-700">${esc(label)}</p>
      <span class="text-[10px] font-black px-1.5 py-0.5 border border-black ${chipColor(valor)}">${valor}%</span>
    </div>
  `;
}

function metricCard(label, valor, icon, color) {
  return `
    <div class="bg-white border-2 border-black p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-center">
      <div class="flex items-center justify-center gap-1 mb-1">
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>
        <p class="text-[9px] font-bold uppercase tracking-wider text-gray-500">${label}</p>
      </div>
      <p class="text-2xl font-black">${valor}</p>
    </div>
  `;
}

function renderSemDados() {
  return `<p class="text-xs font-bold text-gray-400">Sem dados suficientes para esse bloco.</p>`;
}

function resumoFallback() {
  return {
    titulo: 'Diagnóstico indisponível',
    descricao: 'Não foi possível gerar o resumo agora.',
    corTexto: 'text-gray-700'
  };
}

function loadingHTML() {
  return `<div class="animate-fade-in"><div class="border-b-4 border-black pb-4 mb-6">
    <h2 class="text-2xl md:text-3xl font-black uppercase tracking-tight">Guia e Tutorial</h2>
    <p class="text-gray-500 font-bold text-sm mt-1">Carregando...</p>
  </div><div class="h-40 skeleton rounded"></div></div>`;
}

function hasAnyNotaBimestral(row) {
  const keys = [
    'mat_adicao',
    'mat_subtracao',
    'mat_multiplicacao',
    'mat_divisao',
    'mat_resolucao',
    'port_escrita',
    'port_leitura',
    'port_interpretacao',
    'port_pontuacao',
    'af_localizar_info',
    'af_inferir_sentido',
    'af_identificar_tema',
    'af_pontuacao_sentido'
  ];
  return keys.some((k) => {
    const v = Number(row?.[k]);
    return Number.isFinite(v) && v > 0;
  });
}

function hasFreqSnapshot(row) {
  const keys = [
    'freq_total_bimestre',
    'freq_presencas_bimestre',
    'freq_faltas_bimestre',
    'freq_percentual_bimestre'
  ];
  return keys.some((k) => row?.[k] !== undefined && row?.[k] !== null && String(row?.[k]).trim() !== '');
}

function normalizaStatus(status) {
  const s = String(status || '').toUpperCase().trim();
  if (s.includes('LIDO')) return 'LIDO_PELO_REGENTE';
  if (s.includes('ATENDIDO')) return 'ATENDIDO_PELO_REFORCO';
  return 'PENDENTE';
}

function isPresent(r) {
  return r?.compareceu === 1 || r?.compareceu === true || r?.presente === 1 || r?.presente === true;
}

function countFilled(arr, getVal) {
  return arr.reduce((acc, item) => (hasValue(getVal(item)) ? acc + 1 : acc), 0);
}

function hasValue(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  return !!v;
}

function pct(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function media(values = []) {
  if (!values.length) return 0;
  const soma = values.reduce((acc, n) => acc + (Number(n) || 0), 0);
  return Math.round(soma / values.length);
}

function formatDateTimeBR(dateObj) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  } catch (e) {
    return String(dateObj || '');
  }
}

function calcDias(dataIni, dataFim) {
  const ini = parseDateOnly(dataIni);
  const fim = parseDateOnly(dataFim);
  if (!ini || !fim) return null;
  const diff = fim.getTime() - ini.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function parseDateOnly(v) {
  const txt = String(v || '').trim();
  if (!txt || !txt.includes('-')) return null;
  const [yy, mm, dd] = txt.split('-').map((x) => Number(x));
  if (!yy || !mm || !dd) return null;
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function statusColor(v) {
  if (v >= 85) return 'text-green-700';
  if (v >= 70) return 'text-amber-700';
  return 'text-red-700';
}

function chipColor(v) {
  if (v >= 85) return 'bg-green-100 text-green-900';
  if (v >= 70) return 'bg-amber-100 text-amber-900';
  return 'bg-red-200 text-red-900';
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
