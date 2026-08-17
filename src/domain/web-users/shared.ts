/**
 * Helpers compartilhados pelas tools do domínio Web Users (Epic 16, Release
 * 3, novo 16/08/2026 — US-067, US-068, US-069). Os 3 endpoints usam
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`), confirmados contra `reference/openapi.json`
 * (nenhum dos 3 é `deprecated`) e, adicionalmente, contra chamada real em
 * homologação nesta rodada (ver comentário de cada tool).
 *
 * Nome do domínio ("web_users") deliberadamente distinto de "accounts"
 * (Epic 9 — clientes/subclientes/perfis/centrais via `UsersIntegracao`
 * oauth2ClientCredentials) para não confundir com US-032 (usuários via
 * Integracao, bloqueada por GAP-018) nem com `get_user_profiles` (perfis,
 * não usuários). Ver CLAUDE.md Seção 0/Seção 9.
 *
 * DADOS SENSÍVEIS (CLAUDE.md Seção 8: e-mail, telefone, CPF/CNPJ,
 * identificadores de usuário/cliente/subcliente): mesma decisão já tomada e
 * documentada em `domain/accounts/search-clients.ts` para o mesmo tipo de
 * campo (`cnpj`/`email`/`cel`) — mascarados apenas no log de auditoria
 * (automático via `deepMask` em `audit-logger.ts`; a resposta normalizada da
 * tool nunca inclui o payload bruto no registro de auditoria), nunca na
 * resposta normalizada ao consumidor já autorizado para a central. Mantida
 * aqui por consistência transversal, não uma decisão nova desta rodada.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as WebUsersToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
