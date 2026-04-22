/**
 * 🔥 Camada de acesso ao Firestore — Espelho do crud.py
 * Todas as operações CRUD para o sistema de Reforço Escolar.
 */

import { getDb, isFirebaseConfigured } from './firebase-config.js';
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  query, where, getDoc, setDoc
} from 'firebase/firestore';

// ==========================================
// HELPERS
// ==========================================
function docsToList(snapshot) {
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const DEFAULT_ESCOLA_NOME = 'Escola Ver. Eliel Peixoto de Melo';
const DEFAULT_ESCOLA_NOME_NORM = normalizeText(DEFAULT_ESCOLA_NOME);
const DEFAULT_COORD_NOME = 'Arcelino';
const DEFAULT_COORD_SENHA = '123456';
const DEMO_ESCOLA = { id: 'demo_escola_padrao', nome: DEFAULT_ESCOLA_NOME, is_default: true };
const SCHOOL_SCOPED_COLLECTIONS = new Set([
  'etapas',
  'turmas',
  'estudantes',
  'professores_reforco',
  'professores_regentes',
  'registros_diarios',
  'consolidados_mensais',
  'encaminhamentos',
  'configuracoes'
]);

let currentEscolaId = '';
let currentEscolaNome = '';
let defaultEscolaCache = null;

const CACHE_TTL_MS = 60 * 1000;
const cacheStore = new Map();
const pendingRequests = new Map();

function scopeCacheKey(key) {
  const raw = String(key || '');
  if (raw.startsWith('global:')) return raw;
  const esc = String(currentEscolaId || '__sem_escola__');
  return `escola:${esc}:${raw}`;
}

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getCacheWithMeta(key) {
  const scoped = scopeCacheKey(key);
  const entry = cacheStore.get(scoped);
  if (!entry) return { hit: false, value: null };
  if (Date.now() > entry.expireAt) {
    cacheStore.delete(scoped);
    return { hit: false, value: null };
  }
  return { hit: true, value: deepClone(entry.value) };
}

function getCache(key) {
  const cached = getCacheWithMeta(key);
  return cached.hit ? cached.value : null;
}

function setCache(key, value, ttlMs = CACHE_TTL_MS) {
  const scoped = scopeCacheKey(key);
  cacheStore.set(scoped, {
    value: deepClone(value),
    expireAt: Date.now() + ttlMs
  });
}

function invalidateCache(prefixes = []) {
  if (!Array.isArray(prefixes) || prefixes.length === 0) return;
  const keys = Array.from(cacheStore.keys());
  keys.forEach((k) => {
    if (prefixes.some((p) => k.startsWith(p) || k.includes(`:${p}`))) cacheStore.delete(k);
  });
}

function invalidateCadastroCaches() {
  invalidateCache([
    'etapas:',
    'turmas:',
    'estudantes:',
    'profs_reforco:',
    'profs_regentes:',
    'registros_',
    'consol_',
    'enc_',
    'stats_coord:'
  ]);
}

function invalidateRegistrosCaches() {
  invalidateCache([
    'registros_',
    'presencas_est:',
    'freq_bim:',
    'media_bim:',
    'stats_coord:'
  ]);
}

function invalidateConsolidadosCaches() {
  invalidateCache([
    'consol_',
    'media_bim:',
    'stats_coord:'
  ]);
}

function invalidateEncaminhamentosCaches() {
  invalidateCache([
    'enc_'
  ]);
}

async function getOrFetchCached(key, fetcher, ttlMs = CACHE_TTL_MS) {
  const scoped = scopeCacheKey(key);
  const cached = getCacheWithMeta(key);
  if (cached.hit) return cached.value;

  const pending = pendingRequests.get(scoped);
  if (pending) return deepClone(await pending);

  const task = (async () => {
    const value = await fetcher();
    setCache(key, value, ttlMs);
    return value;
  })();

  pendingRequests.set(scoped, task);
  try {
    return deepClone(await task);
  } finally {
    pendingRequests.delete(scoped);
  }
}

function isCollectionScopedBySchool(collectionName) {
  return SCHOOL_SCOPED_COLLECTIONS.has(String(collectionName || ''));
}

function parseIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const stamp = Date.parse(raw);
  return Number.isNaN(stamp) ? 0 : stamp;
}

function escolaRankingScore(escola, defaultId = '') {
  const nomeNorm = normalizeText(escola?.nome || '');
  const isDefault = escola?.is_default === true ? 1 : 0;
  const isAtiva = escola?.ativa === 0 ? 0 : 1;
  const isPreferredDefault = nomeNorm === DEFAULT_ESCOLA_NOME_NORM ? 1 : 0;
  const isChosenDefault = String(escola?.id || '') === String(defaultId || '') ? 1 : 0;
  const createdAt = parseIsoDate(escola?.criado_em);
  return (
    isChosenDefault * 1_000_000 +
    isDefault * 100_000 +
    isPreferredDefault * 10_000 +
    isAtiva * 1_000 +
    createdAt
  );
}

function escolherMelhorEscola(atual, candidata, defaultId = '') {
  if (!atual) return candidata;
  const scoreAtual = escolaRankingScore(atual, defaultId);
  const scoreCandidata = escolaRankingScore(candidata, defaultId);
  if (scoreCandidata > scoreAtual) return candidata;
  if (scoreCandidata < scoreAtual) return atual;
  return String(candidata?.id || '').localeCompare(String(atual?.id || '')) > 0 ? candidata : atual;
}

function deduplicarEscolasPorNome(escolas = [], defaultId = '') {
  const map = new Map();
  escolas.forEach((e) => {
    if (e?.ativa === 0) return;
    const nomeNorm = normalizeText(e?.nome || '');
    const key = nomeNorm || `__sem_nome__${String(e?.id || '')}`;
    const atual = map.get(key);
    map.set(key, escolherMelhorEscola(atual, e, defaultId));
  });
  return [...map.values()]
    .sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
}

export function setEscolaContext(escolaId, escolaNome = '') {
  currentEscolaId = String(escolaId || '').trim();
  if (escolaNome !== undefined && escolaNome !== null) {
    currentEscolaNome = String(escolaNome || '').trim();
  }
}

export function getEscolaContext() {
  return {
    escolaId: currentEscolaId || '',
    escolaNome: currentEscolaNome || ''
  };
}

async function resolveEscolaContext() {
  if (!isFirebaseConfigured()) {
    if (!currentEscolaId) setEscolaContext(DEMO_ESCOLA.id, DEMO_ESCOLA.nome);
    return { ...DEMO_ESCOLA, id: currentEscolaId || DEMO_ESCOLA.id, nome: currentEscolaNome || DEMO_ESCOLA.nome };
  }

  if (currentEscolaId) return { id: currentEscolaId, nome: currentEscolaNome || '' };

  const padrao = await garantirEscolaPadrao();
  setEscolaContext(padrao.id, padrao.nome);
  return { id: padrao.id, nome: padrao.nome || '' };
}

async function getCurrentEscolaId() {
  const ctx = await resolveEscolaContext();
  return String(ctx.id || '');
}

async function filtrarDocsPorEscola(docs, collectionName = '') {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  if (!isCollectionScopedBySchool(collectionName)) return docs;

  const escolaAtual = await resolveEscolaContext();
  const padrao = await garantirEscolaPadrao();
  const isDefault = String(escolaAtual.id || '') === String(padrao.id || '');

  return docs.filter((d) => {
    const docEscola = String(d?.escola_id || '').trim();
    if (!docEscola) return isDefault; // compatibilidade legada
    return docEscola === escolaAtual.id;
  });
}

async function listarColecaoPorEscola(collectionName) {
  const db = getDb();
  const snap = await getDocs(collection(db, collectionName));
  const docs = docsToList(snap);
  return filtrarDocsPorEscola(docs, collectionName);
}

// ==========================================
// ESCOLAS (multi-escola)
// ==========================================
export async function garantirEscolaPadrao() {
  if (!isFirebaseConfigured()) return { ...DEMO_ESCOLA };
  if (defaultEscolaCache?.id) return deepClone(defaultEscolaCache);

  const cacheKey = 'global:escolas:default';
  const fromCache = getCache(cacheKey);
  if (fromCache?.id) {
    defaultEscolaCache = deepClone(fromCache);
    return fromCache;
  }

  const db = getDb();
  const snap = await getDocs(collection(db, 'escolas'));
  const escolas = docsToList(snap);

  const ativas = escolas.filter((e) => e?.ativa !== 0);
  let candidatas = ativas.filter((e) => e?.is_default === true);
  if (!candidatas.length) {
    candidatas = ativas.filter((e) => normalizeText(e?.nome || '') === DEFAULT_ESCOLA_NOME_NORM);
  }
  if (!candidatas.length) candidatas = ativas;
  let padrao = null;
  candidatas.forEach((e) => {
    padrao = escolherMelhorEscola(padrao, e);
  });

  if (!padrao) {
    const payload = {
      nome: DEFAULT_ESCOLA_NOME,
      is_default: true,
      ativa: 1,
      criado_em: new Date().toISOString().split('T')[0]
    };
    const ref = await addDoc(collection(db, 'escolas'), payload);
    padrao = { id: ref.id, ...payload };
  } else {
    const updatesPadrao = {};
    if (padrao.is_default !== true) updatesPadrao.is_default = true;
    if (padrao.ativa === 0) updatesPadrao.ativa = 1;
    if (Object.keys(updatesPadrao).length > 0) {
      await updateDoc(doc(db, 'escolas', String(padrao.id)), updatesPadrao);
      padrao = { ...padrao, ...updatesPadrao };
    }

    const ajustesDefault = escolas
      .filter((e) => String(e?.id || '') !== String(padrao.id))
      .filter((e) => e?.is_default === true);

    await Promise.all(
      ajustesDefault.map((e) =>
        updateDoc(doc(db, 'escolas', String(e.id)), { is_default: false })
      )
    );
  }

  defaultEscolaCache = deepClone(padrao);
  setCache(cacheKey, padrao, 10 * 60 * 1000);
  return deepClone(padrao);
}

export async function listarEscolas() {
  if (!isFirebaseConfigured()) return [{ ...DEMO_ESCOLA }];
  const padrao = await garantirEscolaPadrao();

  const cacheKey = 'global:escolas:all';
  return getOrFetchCached(cacheKey, async () => {
    const db = getDb();
    const snap = await getDocs(collection(db, 'escolas'));
    const escolasRaw = docsToList(snap);
    const escolas = deduplicarEscolasPorNome(escolasRaw, String(padrao?.id || ''));
    const padraoDedupe = escolas.find((e) => String(e?.id || '') === String(padrao?.id || ''))
      || escolas.find((e) => e?.is_default === true)
      || escolas[0];
    if (padraoDedupe?.id) defaultEscolaCache = deepClone(padraoDedupe);
    return escolas;
  }, 10 * 60 * 1000);
}

export async function criarEscola(nome) {
  if (!isFirebaseConfigured()) throw new Error('Firebase não configurado.');
  const nomeLimpo = String(nome || '').trim();
  if (!nomeLimpo) throw new Error('Nome da escola é obrigatório.');

  const escolas = await listarEscolas();
  const exists = escolas.some((e) => normalizeText(e.nome) === normalizeText(nomeLimpo));
  if (exists) throw new Error('Já existe uma escola com esse nome.');

  const db = getDb();
  const payload = {
    nome: nomeLimpo,
    is_default: false,
    ativa: 1,
    criado_em: new Date().toISOString().split('T')[0]
  };
  const ref = await addDoc(collection(db, 'escolas'), payload);
  invalidateCache(['global:escolas:']);
  return ref.id;
}

export async function garantirCoordenadorPadrao() {
  if (!isFirebaseConfigured()) {
    return {
      id: 'demo_coord_padrao',
      nome: DEFAULT_COORD_NOME,
      senha: DEFAULT_COORD_SENHA,
      escola_id: DEMO_ESCOLA.id,
      is_default: true,
      ativo: 1
    };
  }

  const escolaPadrao = await garantirEscolaPadrao();
  const cacheKey = `global:coords:default:${String(escolaPadrao.id)}`;
  const fromCache = getCache(cacheKey);
  if (fromCache?.id) return fromCache;

  const db = getDb();
  const snap = await getDocs(collection(db, 'coordenadores'));
  const todos = docsToList(snap);
  const daEscola = todos.filter((c) => {
    const esc = String(c?.escola_id || '').trim();
    if (!esc) return true; // legado: coordenador sem escola_id pertence à escola padrão
    return esc === String(escolaPadrao.id);
  });

  let arcelino = daEscola.find((c) => normalizeText(c.nome) === normalizeText(DEFAULT_COORD_NOME));

  if (!arcelino) {
    const payload = {
      nome: DEFAULT_COORD_NOME,
      senha: DEFAULT_COORD_SENHA,
      escola_id: String(escolaPadrao.id),
      ativo: 1,
      is_default: true,
      criado_em: new Date().toISOString().split('T')[0]
    };
    const ref = await addDoc(collection(db, 'coordenadores'), payload);
    arcelino = { id: ref.id, ...payload };
  } else {
    const updates = {};
    if (!arcelino.escola_id) updates.escola_id = String(escolaPadrao.id);
    if (!arcelino.senha) updates.senha = DEFAULT_COORD_SENHA;
    if (arcelino.is_default !== true) updates.is_default = true;
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, 'coordenadores', String(arcelino.id)), updates);
      arcelino = { ...arcelino, ...updates };
    }
  }

  setCache(cacheKey, arcelino, 10 * 60 * 1000);
  return deepClone(arcelino);
}

export async function listarCoordenadores(escolaId = null) {
  if (!isFirebaseConfigured()) {
    const esc = escolaId || DEMO_ESCOLA.id;
    if (String(esc) !== String(DEMO_ESCOLA.id)) return [];
    return [{
      id: 'demo_coord_padrao',
      nome: DEFAULT_COORD_NOME,
      senha: DEFAULT_COORD_SENHA,
      escola_id: DEMO_ESCOLA.id,
      is_default: true,
      ativo: 1
    }];
  }

  await garantirCoordenadorPadrao();
  const cacheKey = `global:coords:${escolaId ? String(escolaId) : 'all'}`;
  return getOrFetchCached(cacheKey, async () => {
    const escolaPadrao = await garantirEscolaPadrao();
    const db = getDb();
    const snap = await getDocs(collection(db, 'coordenadores'));
    let coords = docsToList(snap);

    if (escolaId) {
      const escId = String(escolaId);
      const isDefault = escId === String(escolaPadrao.id || '');
      coords = coords.filter((c) => {
        const docEsc = String(c?.escola_id || '').trim();
        if (!docEsc) return isDefault;
        return docEsc === escId;
      });
    }

    return coords
      .filter((c) => c.ativo !== 0)
      .sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || '')));
  }, 10 * 60 * 1000);
}

export async function criarCoordenador(nome, senha, escolaId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase não configurado.');
  const nomeLimpo = String(nome || '').trim();
  const senhaLimpa = String(senha || '').trim();
  const escolaIdLimpo = String(escolaId || '').trim();
  if (!nomeLimpo) throw new Error('Nome do coordenador é obrigatório.');
  if (!senhaLimpa) throw new Error('Senha do coordenador é obrigatória.');
  if (!escolaIdLimpo) throw new Error('Escola do coordenador é obrigatória.');

  const escolas = await listarEscolas();
  const escolaExiste = escolas.some((e) => String(e.id) === escolaIdLimpo);
  if (!escolaExiste) throw new Error('Escola selecionada não existe.');

  const coordsEscola = await listarCoordenadores(escolaIdLimpo);
  const duplicado = coordsEscola.some((c) => normalizeText(c.nome) === normalizeText(nomeLimpo));
  if (duplicado) throw new Error('Já existe coordenador com esse nome nesta escola.');

  const db = getDb();
  const payload = {
    nome: nomeLimpo,
    senha: senhaLimpa,
    escola_id: escolaIdLimpo,
    ativo: 1,
    is_default: false,
    criado_em: new Date().toISOString().split('T')[0]
  };
  const ref = await addDoc(collection(db, 'coordenadores'), payload);
  invalidateCache(['global:coords:']);
  return ref.id;
}

export async function atualizarCoordenador(id, data = {}) {
  if (!isFirebaseConfigured()) throw new Error('Firebase não configurado.');
  const db = getDb();
  const payload = {};
  if (data.nome !== undefined) payload.nome = String(data.nome || '').trim();
  if (data.senha !== undefined) payload.senha = String(data.senha || '').trim();
  if (data.escola_id !== undefined) payload.escola_id = String(data.escola_id || '').trim();
  if (data.ativo !== undefined) payload.ativo = data.ativo ? 1 : 0;
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, 'coordenadores', String(id)), payload);
  invalidateCache(['global:coords:']);
}

export async function excluirCoordenador(id) {
  if (!isFirebaseConfigured()) throw new Error('Firebase não configurado.');
  const db = getDb();
  await deleteDoc(doc(db, 'coordenadores', String(id)));
  invalidateCache(['global:coords:']);
}

export async function autenticarCoordenador(escolaId, coordenadorId, senha) {
  const escId = String(escolaId || '').trim();
  const coordId = String(coordenadorId || '').trim();
  const senhaDigitada = String(senha || '');
  if (!escId || !coordId || !senhaDigitada) return null;

  const coords = await listarCoordenadores(escId);
  const coord = coords.find((c) => String(c.id) === coordId);
  if (!coord) return null;
  if (String(coord.senha || '') !== senhaDigitada) return null;
  return coord;
}

// ==========================================
// ETAPAS
// ==========================================
const DEFAULT_ETAPAS = ["EDUCAÇÃO INFANTIL", "ANOS INICIAIS", "ANOS FINAIS", "EJA"];

export async function garantirEtapasPadrao() {
  if (!isFirebaseConfigured()) return;
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const etapas = await listarColecaoPorEscola('etapas');
  const existentes = etapas.map((d) => d.nome);

  for (const nome of DEFAULT_ETAPAS) {
    if (!existentes.includes(nome)) {
      await addDoc(collection(db, 'etapas'), { nome, escola_id: escolaId });
    }
  }
}

export async function listarEtapas() {
  if (!isFirebaseConfigured()) {
    return DEFAULT_ETAPAS.map((nome, i) => ({ id: `etapa_${i}`, nome }));
  }
  const cacheKey = 'etapas:all';
  return getOrFetchCached(cacheKey, async () => {
    await garantirEtapasPadrao();
    return listarColecaoPorEscola('etapas');
  });
}

// ==========================================
// TURMAS (enriquecidas com etapa_nome)
// ==========================================
export async function criarTurma(nome, etapaId) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const ref = await addDoc(collection(db, 'turmas'), {
    nome,
    etapa_id: String(etapaId),
    escola_id: escolaId
  });
  invalidateCadastroCaches();
  return ref.id;
}

export async function atualizarTurma(id, nome, etapaId) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await updateDoc(doc(db, 'turmas', String(id)), {
    nome,
    etapa_id: String(etapaId),
    escola_id: escolaId
  });
  invalidateCadastroCaches();
}

export async function listarTurmas(etapaId = null) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `turmas:${etapaId ? String(etapaId) : 'all'}`;
  return getOrFetchCached(cacheKey, async () => {
    const [etapasArr, turmasArrRaw] = await Promise.all([
      listarEtapas(),
      listarColecaoPorEscola('turmas')
    ]);

    // Mapa de etapas
    const etapasMap = {};
    etapasArr.forEach((d) => { etapasMap[d.id] = d.nome || ''; });

    // Turmas
    let turmasArr = turmasArrRaw;
    if (etapaId) turmasArr = turmasArr.filter(t => t.etapa_id === String(etapaId));

    // Enriquecer
    turmasArr.forEach(t => { t.etapa_nome = etapasMap[t.etapa_id] || ''; });
    return turmasArr.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });
}

export async function excluirTurma(id) {
  const db = getDb();
  // Cascading delete: remover estudantes da turma
  const estudantesTurma = await listarEstudantes(String(id), true);
  for (const est of estudantesTurma) {
    await deleteDoc(doc(db, 'estudantes', String(est.id)));
  }
  await deleteDoc(doc(db, 'turmas', String(id)));
  invalidateCadastroCaches();
}

// ==========================================
// ESTUDANTES (enriquecidos com turma_nome, etapa_nome)
// ==========================================
export async function criarEstudante(nome, turmaId) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const ref = await addDoc(collection(db, 'estudantes'), {
    nome,
    turma_id: String(turmaId),
    ativo: 1,
    escola_id: escolaId
  });
  invalidateCadastroCaches();
  return ref.id;
}

export async function atualizarEstudante(id, nome, turmaId) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await updateDoc(doc(db, 'estudantes', String(id)), {
    nome,
    turma_id: String(turmaId),
    escola_id: escolaId
  });
  invalidateCadastroCaches();
}

export async function listarEstudantes(turmaId = null, incluirInativos = false) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `estudantes:${turmaId ? String(turmaId) : 'all'}:${incluirInativos ? 'with_inactive' : 'active_only'}`;
  return getOrFetchCached(cacheKey, async () => {
    // Mapa de turmas
    const [turmas, estudantesSnap] = await Promise.all([
      listarTurmas(),
      listarColecaoPorEscola('estudantes')
    ]);
    const turmasMap = {};
    turmas.forEach(t => { turmasMap[t.id] = t; });

    let estudantes = estudantesSnap;
    if (turmaId) estudantes = estudantes.filter(e => e.turma_id === String(turmaId));

    const result = [];
    for (const est of estudantes) {
      if (!incluirInativos && est.ativo !== undefined && est.ativo !== 1) continue;
      const tInfo = turmasMap[est.turma_id] || {};
      est.turma_nome = tInfo.nome || '';
      est.etapa_nome = tInfo.etapa_nome || '';
      result.push(est);
    }
    return result.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });
}

export async function excluirEstudante(id) {
  const db = getDb();
  await deleteDoc(doc(db, 'estudantes', String(id)));
  invalidateCadastroCaches();
}

// ==========================================
// PROFESSORES REFORÇO
// ==========================================
export async function criarProfReforco(nome, area, turmasIds) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const ref = await addDoc(collection(db, 'professores_reforco'), {
    nome, area, turmas_ids: turmasIds.map(String), escola_id: escolaId
  });
  invalidateCadastroCaches();
  return ref.id;
}

export async function atualizarProfReforco(id, nome, area, turmasIds) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await updateDoc(doc(db, 'professores_reforco', String(id)), {
    nome, area, turmas_ids: turmasIds.map(String), escola_id: escolaId
  });
  invalidateCadastroCaches();
}

export async function listarProfsReforco() {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = 'profs_reforco:all';
  return getOrFetchCached(cacheKey, async () => {
    return (await listarColecaoPorEscola('professores_reforco'))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });
}

export async function excluirProfReforco(id) {
  const db = getDb();
  await deleteDoc(doc(db, 'professores_reforco', String(id)));
  invalidateCadastroCaches();
}

export async function obterTurmasProfReforco(profId) {
  const cacheKey = `profs_reforco:turmas:${String(profId)}`;
  return getOrFetchCached(cacheKey, async () => {
    const db = getDb();
    const snap = await getDoc(doc(db, 'professores_reforco', String(profId)));
    if (!snap.exists()) return [];
    const docs = await filtrarDocsPorEscola([{ id: snap.id, ...snap.data() }], 'professores_reforco');
    if (!docs.length) return [];
    return docs[0].turmas_ids || [];
  });
}

// ==========================================
// PROFESSORES REGENTES
// ==========================================
export async function criarProfRegente(nome, area, turmasIds) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const ref = await addDoc(collection(db, 'professores_regentes'), {
    nome, area, turmas_ids: turmasIds.map(String), escola_id: escolaId
  });
  invalidateCadastroCaches();
  return ref.id;
}

export async function atualizarProfRegente(id, nome, area, turmasIds) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await updateDoc(doc(db, 'professores_regentes', String(id)), {
    nome, area, turmas_ids: turmasIds.map(String), escola_id: escolaId
  });
  invalidateCadastroCaches();
}

export async function listarProfsRegentes() {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = 'profs_regentes:all';
  return getOrFetchCached(cacheKey, async () => {
    return (await listarColecaoPorEscola('professores_regentes'))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  });
}

export async function excluirProfRegente(id) {
  const db = getDb();
  await deleteDoc(doc(db, 'professores_regentes', String(id)));
  invalidateCadastroCaches();
}

export async function obterTurmasProfRegente(profId) {
  const cacheKey = `profs_regentes:turmas:${String(profId)}`;
  return getOrFetchCached(cacheKey, async () => {
    const db = getDb();
    const snap = await getDoc(doc(db, 'professores_regentes', String(profId)));
    if (!snap.exists()) return [];
    const docs = await filtrarDocsPorEscola([{ id: snap.id, ...snap.data() }], 'professores_regentes');
    if (!docs.length) return [];
    return docs[0].turmas_ids || [];
  });
}

// ==========================================
// ESTATÍSTICAS COORDENAÇÃO
// ==========================================
export async function obterEstatisticasCoordenacao(mes, ano) {
  if (!isFirebaseConfigured()) return null;
  const cacheKey = `stats_coord:${String(ano)}-${String(mes).padStart(2, '0')}`;
  return getOrFetchCached(cacheKey, async () => {
    const [profsReforco, profsRegentes, regsMes, estudantes, turmas] = await Promise.all([
      listarProfsReforco(),
      listarProfsRegentes(),
      listarTodosRegistrosMes(mes, ano),
      listarEstudantes(null, true),
      listarTurmas()
    ]);
    const turmasMap = {};
    turmas.forEach(t => { turmasMap[t.id] = t; });

    const etapasCount = {};
    estudantes.forEach(e => {
      const tInfo = turmasMap[e.turma_id] || {};
      const enome = tInfo.etapa_nome || 'Sem Etapa';
      etapasCount[enome] = (etapasCount[enome] || 0) + 1;
    });

    return {
      qtd_prof_reforco: profsReforco.length,
      qtd_prof_regente: profsRegentes.length,
      qtd_total_estudantes: estudantes.length,
      qtd_registros_mes: regsMes.length,
      estudantes_por_etapa: Object.entries(etapasCount).map(([k, v]) => ({ etapa_nome: k, contagem: v }))
    };
  });
}

// ==========================================
// REGISTROS DIÁRIOS (para Ver Registros)
// ==========================================
export async function listarTodosRegistrosMes(mes, ano) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `registros_mes:${String(ano)}-${String(mes).padStart(2, '0')}`;
  return getOrFetchCached(cacheKey, async () => {
    const db = getDb();

    const startDate = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-01`;
    const endDate = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-31`;
    const [regsSnap, estudantes, profsR] = await Promise.all([
      getDocs(
        query(collection(db, 'registros_diarios'),
          where('data_registro', '>=', startDate),
          where('data_registro', '<=', endDate))
      ),
      listarEstudantes(null, true),
      listarProfsReforco()
    ]);
    const regs = await filtrarDocsPorEscola(docsToList(regsSnap), 'registros_diarios');

    // Enriquecer com nomes
    const estMap = {};
    estudantes.forEach(e => { estMap[e.id] = e; });

    const profsRMap = {};
    profsR.forEach(p => { profsRMap[p.id] = p; });

    regs.forEach(r => {
      const est = estMap[r.estudante_id] || {};
      r.estudante_nome = est.nome || '';
      r.turma_nome = est.turma_nome || '';
      const prof = profsRMap[r.prof_id] || {};
      r.prof_nome = prof.nome || '';
      r.prof_area = prof.area || '';
    });

    return regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  });
}

export async function listarRegistrosDiariosTodos() {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = 'registros_all';
  return getOrFetchCached(cacheKey, async () => {
    const db = getDb();
    const snap = await getDocs(collection(db, 'registros_diarios'));
    let regs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
    regs = await buildRegistrosDiarios(regs);
    return regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  });
}

// ==========================================
// REGISTROS DIÁRIOS (Professor Reforço)
// ==========================================
export async function verificarRegistroDuplicado(estudanteId, profId, dataRegistro) {
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('estudante_id', '==', String(estudanteId)),
      where('prof_id', '==', String(profId)),
      where('data_registro', '==', dataRegistro)
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  return docs.length > 0;
}

export async function criarRegistroDiario(data) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  if (await verificarRegistroDuplicado(data.estudante_id, data.prof_id, data.data_registro)) {
    return null; // Duplicata
  }
  const payload = {
    estudante_id: String(data.estudante_id),
    prof_id: String(data.prof_id),
    data_registro: data.data_registro,
    bimestre: data.bimestre,
    prof_regente_id: data.prof_regente_id ? String(data.prof_regente_id) : null,
    compareceu: data.compareceu,
    motivo_falta: data.motivo_falta || null,
    origem_conteudo: data.origem_conteudo || null,
    habilidade_trabalhada: data.habilidade_trabalhada || null,
    nivel_compreensao: data.nivel_compreensao || "Não Avaliado",
    participacao: data.participacao || null,
    observacao: data.observacao || null,
    dificuldade_latente: data.dificuldade_latente || null,
    tipo_atividade: data.tipo_atividade || null,
    estado_emocional: data.estado_emocional || null,
    escola_id: escolaId
  };
  const ref = await addDoc(collection(db, 'registros_diarios'), payload);
  invalidateRegistrosCaches();
  return ref.id;
}

export async function atualizarRegistroDiario(id, data) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await updateDoc(doc(db, 'registros_diarios', String(id)), { ...data, escola_id: escolaId });
  invalidateRegistrosCaches();
}

export async function excluirRegistroDiario(id) {
  const db = getDb();
  await deleteDoc(doc(db, 'registros_diarios', String(id)));
  invalidateRegistrosCaches();
}

async function buildRegistrosDiarios(regs) {
  const [estudantes, profsReforco, profsRegentes] = await Promise.all([
    listarEstudantes(null, true),
    listarProfsReforco(),
    listarProfsRegentes()
  ]);
  const estMap = {}; estudantes.forEach(e => estMap[e.id] = e);
  const profsRMap = {}; profsReforco.forEach(p => profsRMap[p.id] = p);
  const profsRegMap = {}; profsRegentes.forEach(p => profsRegMap[p.id] = p);

  regs.forEach(r => {
    const e = estMap[r.estudante_id] || {};
    r.estudante_nome = e.nome || '';
    r.turma_nome = e.turma_nome || '';
    r.etapa_nome = e.etapa_nome || '';
    
    const pRef = profsRMap[r.prof_id] || {};
    r.prof_nome = pRef.nome || '';
    r.prof_area = pRef.area || '';
    
    const pReg = profsRegMap[r.prof_regente_id] || {};
    r.prof_regente_nome = pReg.nome || '';
  });
  return regs;
}

export async function listarRegistrosDiarios(dataRegistro, profId) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `registros_diarios:${dataRegistro}:${String(profId)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('data_registro', '==', dataRegistro),
      where('prof_id', '==', String(profId))
    )
  );
  let regs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  regs = await buildRegistrosDiarios(regs);
  const sorted = regs.sort((a, b) => b.id.localeCompare(a.id));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function listarRegistrosDiariosTrintaDias(profId, turmaId) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `registros_30d:${String(profId)}:${turmaId ? String(turmaId) : 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const t30 = new Date();
  t30.setDate(t30.getDate() - 30);
  const t30Str = t30.toISOString().split('T')[0];

  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('prof_id', '==', String(profId))
    )
  );
  let regs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  regs = regs.filter(r => r.data_registro >= t30Str);
  
  // Filtrar por turma se fornecida
  if (turmaId) {
    const estudantes = await listarEstudantes(String(turmaId));
    const idsEstudantes = estudantes.map(e => e.id);
    regs = regs.filter(r => idsEstudantes.includes(r.estudante_id));
  }
  
  regs = await buildRegistrosDiarios(regs);
  const sorted = regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function contarPresencasEstudante(estudanteId, profId) {
  if (!isFirebaseConfigured()) return 0;
  const cacheKey = `presencas_est:${String(estudanteId)}:${String(profId)}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('estudante_id', '==', String(estudanteId)),
      where('prof_id', '==', String(profId))
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  let count = 0;
  docs.forEach((d) => {
    if (d.compareceu === 1) count++;
  });
  setCache(cacheKey, count);
  return count;
}

// ==========================================
// INTEGRAÇÃO COM REGENTES / ENCAMINHAMENTOS
// ==========================================
export async function obterRegentePorTurmaEArea(turmaId, area) {
  if (!isFirebaseConfigured()) return null;
  if (!area || area === 'Geral') return null;
  const cacheKey = `regente_turma_area:${String(turmaId)}:${String(area)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'professores_regentes'),
      where('area', '==', String(area)),
      where('turmas_ids', 'array-contains', String(turmaId))
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'professores_regentes');
  if (docs.length === 0) return null;
  const reg = docs[0];
  setCache(cacheKey, reg);
  return reg;
}

export async function obterEncaminhamentosPendentes(estudanteId, area) {
  if (!isFirebaseConfigured()) return [];
  const areaNorm = String(area || '').trim().toLowerCase();
  const cacheKey = `enc_pend:${String(estudanteId)}:${areaNorm}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const [snap, profsR] = await Promise.all([
    getDocs(
      query(collection(db, 'encaminhamentos'),
        where('estudante_id', '==', String(estudanteId)),
        where('status', '==', 'PENDENTE')
      )
    ),
    listarProfsRegentes()
  ]);
  const encs = await filtrarDocsPorEscola(docsToList(snap), 'encaminhamentos');
  
  // Filter by area alvo do encaminhamento (fonte oficial)
  let filtrados = encs.filter((e) => String(e.alvo_area || '').trim().toLowerCase() === areaNorm);

  // Enriquecer nome do regente
  const profsRMap = {};
  profsR.forEach(p => profsRMap[p.id] = p);
  
  filtrados = filtrados.map((e) => {
    const reg = profsRMap[e.regente_id];
    e.regente_nome = reg ? reg.nome : 'Regente';
    return e;
  });

  const sorted = filtrados.sort((a, b) => (b.data_solicitacao || '').localeCompare(a.data_solicitacao || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function concluirEncaminhamento(id, resposta) {
  const db = getDb();
  const t = new Date().toISOString().split('T')[0];
  await updateDoc(doc(db, 'encaminhamentos', String(id)), {
    status: 'ATENDIDO_PELO_REFORCO',
    resposta_reforco: resposta || null,
    data_conclusao: t
  });
  invalidateEncaminhamentosCaches();
}

// ==========================================
// CONSOLIDADOS MENSAIS
// ==========================================
export const ESCALA_COMPREENSAO = [
  "Não compreendeu a habilidade",
  "Compreendeu com muita intervenção",
  "Compreendeu com pouca intervenção",
  "Autônomo (Domínio total)"
];

export const ESCALA_NOTA_10 = [
  { nota: 1, titulo: "Início Crítico", descricao: "Ainda não consegue realizar a habilidade, mesmo com ajuda intensa." },
  { nota: 2, titulo: "Muito Inicial", descricao: "Reconhece partes da tarefa, mas depende totalmente da mediação." },
  { nota: 3, titulo: "Inicial", descricao: "Apresenta primeiros acertos com apoio constante do professor." },
  { nota: 4, titulo: "Parcial", descricao: "Compreende parte da habilidade, mas erra sem intervenção frequente." },
  { nota: 5, titulo: "Em Desenvolvimento", descricao: "Executa com apoio contínuo e ainda oscila em autonomia." },
  { nota: 6, titulo: "Intermediário", descricao: "Compreende o essencial com apoio pontual em etapas-chave." },
  { nota: 7, titulo: "Quase Autônomo", descricao: "Resolve a maior parte da habilidade com poucas intervenções." },
  { nota: 8, titulo: "Autônomo Inicial", descricao: "Realiza sozinho na maioria das situações e com boa consistência." },
  { nota: 9, titulo: "Autônomo Consistente", descricao: "Mantém desempenho autônomo e transfere a habilidade com segurança." },
  { nota: 10, titulo: "Domínio Amplo", descricao: "Domínio pleno da habilidade, com precisão e aplicação em novos contextos." }
];

const ESCALA_NOTA_10_MAP = new Map(ESCALA_NOTA_10.map((item) => [item.nota, item]));

const ESCALA_PONTUACAO = {
  "Não compreendeu a habilidade": 1,
  "Compreendeu com muita intervenção": 2,
  "Compreendeu com pouca intervenção": 3,
  "Autônomo (Domínio total)": 4
};

const ESCALA_PONTUACAO_LEGADA = {
  "Não Compreendeu": 1,
  "Compreendeu Parcialmente": 2,
  "Compreendeu Bem": 3,
  "Compreendeu Plenamente": 4
};

export function compreensaoParaNota(valor) {
  if (typeof valor === 'string') {
    if (ESCALA_PONTUACAO[valor]) return ESCALA_PONTUACAO[valor];
    if (ESCALA_PONTUACAO_LEGADA[valor]) return ESCALA_PONTUACAO_LEGADA[valor];
    return 0;
  }
  if (typeof valor === 'number') {
    if (valor <= 3) return 1;
    if (valor <= 5) return 2;
    if (valor <= 7) return 3;
    return 4;
  }
  return 0;
}

export function nota4ParaNota10(valor) {
  const nota4 = Number(valor);
  if (!Number.isFinite(nota4) || nota4 <= 0) return 0;
  return Number((nota4 * 2.5).toFixed(1));
}

export function nota10ParaNota4(valor) {
  const nota10 = Number(valor);
  if (!Number.isFinite(nota10) || nota10 <= 0) return 0;
  if (nota10 <= 3) return 1;
  if (nota10 <= 5) return 2;
  if (nota10 <= 7) return 3;
  return 4;
}

export function compreensaoParaNota10(valor) {
  const nota4 = compreensaoParaNota(valor);
  return nota4 > 0 ? nota4ParaNota10(nota4) : 0;
}

export function nota10Info(valor) {
  const raw = Number(valor);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const nota = Math.max(1, Math.min(10, Math.round(raw)));
  return ESCALA_NOTA_10_MAP.get(nota) || null;
}

export function nota10ParaTexto(valor) {
  const info = nota10Info(valor);
  if (!info) return 'Não Avaliado';
  return `${info.titulo}: ${info.descricao}`;
}

export function compreensaoLabel(valor) {
  if (typeof valor === 'string') {
    if (ESCALA_PONTUACAO[valor] || ESCALA_PONTUACAO_LEGADA[valor]) return valor;
    return 'Não Avaliado';
  }
  if (typeof valor === 'number') {
    if (valor <= 3) return ESCALA_COMPREENSAO[0];
    if (valor <= 5) return ESCALA_COMPREENSAO[1];
    if (valor <= 7) return ESCALA_COMPREENSAO[2];
    return ESCALA_COMPREENSAO[3];
  }
  return 'Não Avaliado';
}

export async function obterMediaDiariaEstudanteBimestre(estudanteId, profId, bimestre) {
  if (!isFirebaseConfigured()) return null;
  const cacheKey = `media_bim:${String(estudanteId)}:${String(profId)}:${String(bimestre)}`;
  const cached = getCache(cacheKey);
  if (cached !== null) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('estudante_id', '==', String(estudanteId)),
      where('prof_id', '==', String(profId)),
      where('bimestre', '==', String(bimestre))
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  let soma = 0;
  let cnt = 0;
  docs.forEach((d) => {
    if (d.compareceu === 1) {
      const nota = compreensaoParaNota(d.nivel_compreensao || 0);
      if (nota > 0) {
        soma += nota;
        cnt++;
      }
    }
  });
  const media = cnt > 0 ? Number((soma / cnt).toFixed(1)) : null;
  setCache(cacheKey, media);
  return media;
}

export async function obterResumoFrequenciaEstudanteBimestre(estudanteId, profId, bimestre) {
  if (!isFirebaseConfigured()) {
    return { total: 0, presencas: 0, faltas: 0, pctPresenca: 0 };
  }

  const cacheKey = `freq_bim:${String(estudanteId)}:${String(profId)}:${String(bimestre)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('estudante_id', '==', String(estudanteId)),
      where('prof_id', '==', String(profId)),
      where('bimestre', '==', String(bimestre))
    )
  );

  const docs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  const total = docs.length;
  const presencas = docs.filter((d) => d.compareceu === 1 || d.compareceu === true).length;
  const faltas = Math.max(0, total - presencas);
  const pctPresenca = total > 0 ? Math.round((presencas / total) * 100) : 0;

  const resumo = { total, presencas, faltas, pctPresenca };
  setCache(cacheKey, resumo);
  return resumo;
}

export async function obterConsolidadoTrimestre(estudanteId, profId, bimestre) {
  if (!isFirebaseConfigured()) return null;
  const cacheKey = `consol_bim:${String(estudanteId)}:${String(profId)}:${String(bimestre)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'consolidados_mensais'),
      where('estudante_id', '==', String(estudanteId)),
      where('prof_id', '==', String(profId)),
      where('bimestre', '==', String(bimestre))
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'consolidados_mensais');
  if (docs.length === 0) return null;
  const consol = docs[0];
  setCache(cacheKey, consol);
  return consol;
}

export async function criarConsolidadoMensal(data) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  data.recomendacao_alta = data.recomendacao_alta || false;
  data.prof_regente_id = data.prof_regente_id ? String(data.prof_regente_id) : null;
  const ref = await addDoc(collection(db, 'consolidados_mensais'), { ...data, escola_id: escolaId });
  invalidateConsolidadosCaches();
  return ref.id;
}

export async function atualizarConsolidadoMensal(id, data) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  data.recomendacao_alta = data.recomendacao_alta || false;
  await updateDoc(doc(db, 'consolidados_mensais', String(id)), { ...data, escola_id: escolaId });
  invalidateConsolidadosCaches();
}

export async function listarConsolidadosMensais() {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = 'consol_all';
  return getOrFetchCached(cacheKey, async () => {
    return listarColecaoPorEscola('consolidados_mensais');
  });
}

export async function listarConsolidadosPorProfReforco(profId) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `consol_prof_reforco:${String(profId)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'consolidados_mensais'),
      where('prof_id', '==', String(profId))
    )
  );
  const regs = await filtrarDocsPorEscola(docsToList(snap), 'consolidados_mensais');
  
  const estudantes = await listarEstudantes(null, true);
  const estMap = {}; estudantes.forEach(e => estMap[e.id] = e);
  
  regs.forEach(r => {
    const e = estMap[r.estudante_id] || {};
    r.estudante_nome = e.nome || '';
    r.turma_nome = e.turma_nome || '';
  });
  
  const sorted = regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function listarRegistrosPorEstudante(estudanteId) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `registros_estudante:${String(estudanteId)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'registros_diarios'),
      where('estudante_id', '==', String(estudanteId))
    )
  );
  let regs = await filtrarDocsPorEscola(docsToList(snap), 'registros_diarios');
  regs = await buildRegistrosDiarios(regs);
  const sorted = regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

// ==========================================
// MÉTODOS DO PROFESSOR REGENTE
// ==========================================
export async function listarRegistrosPorRegente(profRegenteId, bimestreFiltro = "Todos") {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `registros_regente:${String(profRegenteId)}:${String(bimestreFiltro || 'Todos')}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  let snap;
  if (bimestreFiltro && bimestreFiltro !== "Todos") {
    snap = await getDocs(
      query(collection(db, 'registros_diarios'),
        where('prof_regente_id', '==', String(profRegenteId)),
        where('bimestre', '==', String(bimestreFiltro))
      )
    );
  } else {
    snap = await getDocs(
      query(collection(db, 'registros_diarios'),
        where('prof_regente_id', '==', String(profRegenteId))
      )
    );
  }
  let regs = docsToList(snap);
  regs = await filtrarDocsPorEscola(regs, 'registros_diarios');

  const [estudantes, profRevs] = await Promise.all([
    listarEstudantes(null, true),
    listarProfsReforco()
  ]);
  const estMap = {}; estudantes.forEach(e => estMap[e.id] = e);
  const prMap = {}; profRevs.forEach(p => prMap[p.id] = p);

  regs.forEach(r => {
    const e = estMap[r.estudante_id] || {};
    r.estudante_nome = e.nome || '';
    r.turma_nome = e.turma_nome || '';
    r.turma_id = e.turma_id || '';
    r.etapa_nome = e.etapa_nome || '';
    const p = prMap[r.prof_id] || {};
    r.prof_reforco_nome = p.nome || 'Equipe de Reforço';
    r.prof_reforco_area = p.area || '';
    r.prof_nome = r.prof_reforco_nome;
    r.prof_area = r.prof_reforco_area;
  });

  const sorted = regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function listarConsolidadosPorRegente(profRegenteId, bimestreFiltro = "Todos") {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `consol_regente:${String(profRegenteId)}:${String(bimestreFiltro || 'Todos')}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  let snap;
  if (bimestreFiltro && bimestreFiltro !== "Todos") {
    snap = await getDocs(
      query(collection(db, 'consolidados_mensais'),
        where('prof_regente_id', '==', String(profRegenteId)),
        where('bimestre', '==', String(bimestreFiltro))
      )
    );
  } else {
    snap = await getDocs(
      query(collection(db, 'consolidados_mensais'),
        where('prof_regente_id', '==', String(profRegenteId))
      )
    );
  }
  let regs = docsToList(snap);
  regs = await filtrarDocsPorEscola(regs, 'consolidados_mensais');

  const [profRevs, estudantes] = await Promise.all([
    listarProfsReforco(),
    listarEstudantes(null, true)
  ]);
  const prMap = {}; profRevs.forEach(p => prMap[p.id] = p);
  const estMap = {}; estudantes.forEach(e => estMap[e.id] = e);

  regs.forEach(r => {
    r.prof_reforco_nome = prMap[r.prof_id]?.nome || 'Equipe de Reforço';
    const e = estMap[r.estudante_id] || {};
    r.estudante_nome = e.nome || '';
    r.turma_nome = e.turma_nome || '';
  });

  const sorted = regs.sort((a, b) => (b.data_registro || '').localeCompare(a.data_registro || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function criarEncaminhamento(data) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const payload = {
    estudante_id: String(data.estudante_id),
    regente_id: String(data.regente_id),
    alvo_area: String(data.alvo_area),
    habilidade_foco: String(data.habilidade_foco),
    observacao: data.observacao || '',
    data_solicitacao: data.data_solicitacao,
    status: 'PENDENTE',
    escola_id: escolaId
  };
  const ref = await addDoc(collection(db, 'encaminhamentos'), payload);
  invalidateEncaminhamentosCaches();
  return ref.id;
}

export async function listarEncaminhamentos() {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = 'enc_all';
  return getOrFetchCached(cacheKey, async () => {
    return listarColecaoPorEscola('encaminhamentos');
  });
}

export async function listarEncaminhamentosEnviadosEstudante(estudanteId, regenteId) {
  if (!isFirebaseConfigured()) return [];
  const cacheKey = `enc_enviados:${String(estudanteId)}:${String(regenteId)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const snap = await getDocs(
    query(collection(db, 'encaminhamentos'),
      where('estudante_id', '==', String(estudanteId)),
      where('regente_id', '==', String(regenteId))
    )
  );
  const docs = await filtrarDocsPorEscola(docsToList(snap), 'encaminhamentos');
  const sorted = docs.sort((a, b) => (b.data_solicitacao || '').localeCompare(a.data_solicitacao || ''));
  setCache(cacheKey, sorted);
  return sorted;
}

export async function marcarEncaminhamentoLidoRegente(encaminhamentoId) {
  const db = getDb();
  await updateDoc(doc(db, 'encaminhamentos', String(encaminhamentoId)), {
    status: 'LIDO_PELO_REGENTE'
  });
  invalidateEncaminhamentosCaches();
}

// ==========================================
// CÉREBRO/ASSISTENTE IA
// ==========================================
export async function obterContextoIA() {
  if (!isFirebaseConfigured()) return '';
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  const scopedId = `ia_contexto_personalizado_${escolaId}`;
  const snap = await getDoc(doc(db, 'configuracoes', scopedId));
  if (!snap.exists()) {
    const escolaPadrao = await garantirEscolaPadrao();
    const isDefault = String(escolaPadrao.id || '') === String(escolaId || '');
    if (isDefault) {
      // Compatibilidade: contexto antigo global para escola padrão.
      const fallback = await getDoc(doc(db, 'configuracoes', 'ia_contexto_personalizado'));
      if (!fallback.exists()) return '';
      return fallback.data()?.diretrizes || '';
    }
    return '';
  }
  return snap.data()?.diretrizes || '';
}

export async function salvarContextoIA(texto) {
  const db = getDb();
  const escolaId = await getCurrentEscolaId();
  await setDoc(doc(db, 'configuracoes', `ia_contexto_personalizado_${escolaId}`), {
    diretrizes: String(texto || ''),
    escola_id: escolaId
  });
}

function compareceuComoTexto(registro) {
  const compareceu = registro?.compareceu;
  if (compareceu === 1 || compareceu === true) return 'Sim';
  return 'Não';
}

// ==========================================
// TOOLS DA IA (espelho de database/crud.py)
// ==========================================
export async function toolListarAlunosIA(turmaNome = 'Todas') {
  const estudantes = await listarEstudantes();
  const turmaNorm = String(turmaNome || 'Todas').trim().toLowerCase();
  const res = [];

  estudantes.forEach((e) => {
    const turma = String(e.turma_nome || '');
    if (turmaNorm === 'todas' || turma.toLowerCase() === turmaNorm) {
      res.push({
        nome: e.nome || '',
        turma,
        etapa: e.etapa_nome || ''
      });
    }
  });

  return res;
}

export async function toolListarRegistrosMesIA(mes, ano) {
  const regs = await listarTodosRegistrosMes(Number(mes), Number(ano));
  return regs.map((r) => ({
    data: r.data_registro || '',
    aluno: r.estudante_nome || '',
    compareceu: compareceuComoTexto(r),
    motivo_falta: r.motivo_falta || null,
    habilidade: r.habilidade_trabalhada || null,
    compreensao: compreensaoLabel(r.nivel_compreensao ?? 0),
    dificuldade: r.dificuldade_latente || null,
    emocional: r.estado_emocional || null,
    atividade: r.tipo_atividade || null
  }));
}

export async function toolBuscarHistoricoAlunoIA(nomeAlunoParcial) {
  const termo = String(nomeAlunoParcial || '').trim().toLowerCase();
  if (!termo) return { erro: 'Nome do aluno não informado.' };

  const estudantes = await listarEstudantes();
  const alvo = estudantes.find((e) => String(e.nome || '').toLowerCase().includes(termo));

  if (!alvo) {
    return { erro: `Aluno contendo '${nomeAlunoParcial}' não encontrado.` };
  }

  const regs = await listarRegistrosPorEstudante(alvo.id);
  const historico = regs.map((r) => ({
    data: r.data_registro || '',
    compareceu: (r.compareceu === 1 || r.compareceu === true)
      ? 'Sim'
      : `Não - ${r.motivo_falta || 'Sem motivo informado'}`,
    conteudo: r.origem_conteudo || null,
    habilidade: r.habilidade_trabalhada || null,
    compreensao: compreensaoLabel(r.nivel_compreensao ?? 0),
    foco: r.participacao || null,
    obs_prof_reforco: r.observacao || null
  }));

  return {
    nome: alvo.nome || '',
    turma: alvo.turma_nome || '',
    historico_aulas: historico
  };
}

export async function toolListarProfsReforcoIA() {
  const [profs, turmas, estudantes] = await Promise.all([
    listarProfsReforco(),
    listarTurmas(),
    listarEstudantes(null, true)
  ]);

  const turmasMap = {};
  turmas.forEach((t) => { turmasMap[t.id] = t; });

  return profs.map((p) => {
    const turmasDoProf = (p.turmas_ids || []).map((tid) => turmasMap[String(tid)]).filter(Boolean);
    const turmaIds = new Set((p.turmas_ids || []).map((x) => String(x)));
    const alunosProf = estudantes.filter((e) => turmaIds.has(String(e.turma_id || '')));

    return {
      id: p.id,
      nome: p.nome || '',
      area: p.area || '',
      turmas: turmasDoProf.map((t) => t.nome || ''),
      qtd_turmas: turmasDoProf.length,
      qtd_alunos_ativos: alunosProf.filter((e) => e.ativo === 1 || e.ativo === undefined).length,
      qtd_alunos_total: alunosProf.length
    };
  });
}

export async function toolResumoProfessorReforcoIA(nomeProfParcial) {
  const termoRaw = String(nomeProfParcial || '').trim();
  const termo = normalizeText(termoRaw);
  if (!termo) return { erro: 'Nome do professor de reforço não informado.' };

  const [profs, turmas, estudantes] = await Promise.all([
    listarProfsReforco(),
    listarTurmas(),
    listarEstudantes(null, true)
  ]);

  let alvo = profs.find((p) => normalizeText(p.nome).includes(termo));
  if (!alvo) {
    const termoTokens = termo.split(/\s+/).filter(Boolean);
    let melhorScore = 0;
    profs.forEach((p) => {
      const nomeNorm = normalizeText(p.nome);
      const score = termoTokens.reduce((acc, tk) => (nomeNorm.includes(tk) ? acc + 1 : acc), 0);
      if (score > melhorScore) {
        melhorScore = score;
        alvo = p;
      }
    });
    if (melhorScore === 0) alvo = null;
  }

  if (!alvo) {
    return {
      erro: `Professor contendo '${termoRaw}' não encontrado.`,
      sugestoes: profs.slice(0, 8).map((p) => p.nome || '')
    };
  }

  const turmasMap = {};
  turmas.forEach((t) => { turmasMap[t.id] = t; });

  const turmaIds = new Set((alvo.turmas_ids || []).map((x) => String(x)));
  const alunosProf = estudantes.filter((e) => turmaIds.has(String(e.turma_id || '')));
  const alunosAtivos = alunosProf.filter((e) => e.ativo === 1 || e.ativo === undefined);

  const regs30 = await listarRegistrosDiariosTrintaDias(alvo.id, null);
  const alunosAtendidosSet = new Set();
  let faltas30d = 0;

  regs30.forEach((r) => {
    const compareceu = r?.compareceu === 1 || r?.compareceu === true;
    if (compareceu) alunosAtendidosSet.add(String(r.estudante_id || ''));
    else faltas30d += 1;
  });

  return {
    professor: {
      id: alvo.id,
      nome: alvo.nome || '',
      area: alvo.area || ''
    },
    turmas: [...turmaIds].map((tid) => {
      const t = turmasMap[tid] || {};
      return {
        id: tid,
        nome: t.nome || '',
        etapa: t.etapa_nome || ''
      };
    }),
    indicadores: {
      qtd_turmas: turmaIds.size,
      qtd_alunos_ativos: alunosAtivos.length,
      qtd_alunos_total: alunosProf.length,
      qtd_registros_30d: regs30.length,
      qtd_alunos_atendidos_30d: alunosAtendidosSet.size,
      qtd_faltas_30d: faltas30d
    },
    alunos_ativos: alunosAtivos.map((e) => ({
      nome: e.nome || '',
      turma: e.turma_nome || ''
    }))
  };
}

export async function toolResumoSistemaIA() {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const [turmas, estudantesAll, profsRef, profsReg, regsMes, consolidados, encaminhamentos] = await Promise.all([
    listarTurmas(),
    listarEstudantes(null, true),
    listarProfsReforco(),
    listarProfsRegentes(),
    listarTodosRegistrosMes(mes, ano),
    listarConsolidadosMensais(),
    listarEncaminhamentos()
  ]);

  const estudantesAtivos = estudantesAll.filter((e) => e.ativo === 1 || e.ativo === undefined);
  const encPend = encaminhamentos.filter((e) => String(e.status || '') === 'PENDENTE').length;
  const encAten = encaminhamentos.filter((e) => String(e.status || '') === 'ATENDIDO_PELO_REFORCO').length;
  const encLido = encaminhamentos.filter((e) => String(e.status || '') === 'LIDO_PELO_REGENTE').length;

  return {
    referencia: {
      mes,
      ano,
      data: now.toISOString().split('T')[0]
    },
    totais: {
      turmas: turmas.length,
      estudantes_ativos: estudantesAtivos.length,
      estudantes_total: estudantesAll.length,
      professores_reforco: profsRef.length,
      professores_regentes: profsReg.length,
      registros_mes: regsMes.length,
      consolidados_total: consolidados.length,
      encaminhamentos_total: encaminhamentos.length
    },
    encaminhamentos_status: {
      pendente: encPend,
      atendido_pelo_reforco: encAten,
      lido_pelo_regente: encLido
    }
  };
}

export async function toolConsultarColecaoIA(colecao, filtros = {}, limite = 200) {
  if (!isFirebaseConfigured()) {
    return { erro: 'Firebase não configurado no ambiente atual.' };
  }

  const allowlist = new Set([
    'estudantes',
    'turmas',
    'professores_reforco',
    'professores_regentes',
    'registros_diarios',
    'consolidados_mensais',
    'encaminhamentos'
  ]);

  const colecaoNorm = String(colecao || '').trim();
  if (!allowlist.has(colecaoNorm)) {
    return {
      erro: `Coleção '${colecaoNorm}' não permitida para a IA.`,
      colecoes_permitidas: [...allowlist]
    };
  }

  let docs = [];
  if (colecaoNorm === 'estudantes') docs = await listarEstudantes(null, true);
  if (colecaoNorm === 'turmas') docs = await listarTurmas();
  if (colecaoNorm === 'professores_reforco') docs = await listarProfsReforco();
  if (colecaoNorm === 'professores_regentes') docs = await listarProfsRegentes();
  if (colecaoNorm === 'registros_diarios') docs = await listarRegistrosDiariosTodos();
  if (colecaoNorm === 'consolidados_mensais') docs = await listarConsolidadosMensais();
  if (colecaoNorm === 'encaminhamentos') docs = await listarEncaminhamentos();

  // Filtro simples key=value (case-insensitive para strings).
  if (filtros && typeof filtros === 'object') {
    const keys = Object.keys(filtros);
    keys.forEach((k) => {
      const wanted = filtros[k];
      if (wanted === undefined || wanted === null || String(wanted).trim() === '') return;
      const wantedText = normalizeText(wanted);
      docs = docs.filter((d) => {
        const value = d?.[k];
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return normalizeText(value).includes(wantedText);
        return normalizeText(value) === wantedText;
      });
    });
  }

  // Ordenação básica por data, se disponível.
  docs.sort((a, b) => {
    const da = String(a?.data_registro || a?.data_solicitacao || a?.data_conclusao || '');
    const dbv = String(b?.data_registro || b?.data_solicitacao || b?.data_conclusao || '');
    return dbv.localeCompare(da);
  });

  const lim = Number.isFinite(Number(limite)) ? Math.max(1, Math.min(500, Number(limite))) : 200;
  const itens = docs.slice(0, lim);

  return {
    colecao: colecaoNorm,
    total_encontrado: docs.length,
    retornados: itens.length,
    limite_aplicado: lim,
    itens
  };
}
