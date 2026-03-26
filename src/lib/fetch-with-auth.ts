/**
 * Wrapper de fetch mantido por compatibilidade.
 * A autenticação agora é feita pela sessão/cookie do NextAuth.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
  });
}
