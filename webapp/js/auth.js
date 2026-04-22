/**
 * Gerenciamento de sessão do usuário via localStorage.
 * Mantém o login persistente entre recarregamentos.
 */

const SESSION_KEY = 'reforco_app_session';

/**
 * Obtém a sessão atual do localStorage.
 * @returns {Object|null} { perfil, profId, profNome, profArea, turmasIds, escolaId, escolaNome }
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      perfil: parsed?.perfil || '',
      profId: parsed?.profId ?? null,
      profNome: parsed?.profNome || '',
      profArea: parsed?.profArea || '',
      turmasIds: Array.isArray(parsed?.turmasIds) ? parsed.turmasIds : [],
      escolaId: parsed?.escolaId || '',
      escolaNome: parsed?.escolaNome || ''
    };
  } catch (e) {
    return null;
  }
}

/**
 * Define a sessão no localStorage.
 */
export function setSession(perfil, profId, profNome, profArea = '', turmasIds = [], escolaId = '', escolaNome = '') {
  const session = { perfil, profId, profNome, profArea, turmasIds, escolaId, escolaNome };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Remove a sessão do localStorage (logout).
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
