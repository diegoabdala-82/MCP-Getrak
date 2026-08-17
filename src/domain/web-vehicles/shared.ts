/**
 * Helpers compartilhados pelas tools do domínio Web Vehicles (Epic 17,
 * Release 3, novo 16/08/2026 — US-070 a US-075; US-076 fora desta rodada,
 * ver `epicsuserstoriesimplementados.md`). Os 6 endpoints usam
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`), confirmados contra `reference/openapi.json`
 * (nenhum é `deprecated`) e, adicionalmente, contra chamada real em
 * homologação nesta rodada (ver comentário de cada tool).
 *
 * Nome do domínio ("web_vehicles") deliberadamente distinto de "vehicles"
 * (Epic 2 — `VehiclesIntegracao`/`oauth2ClientCredentials`) — mesma
 * convenção já usada para `web_users` vs. `accounts` no Epic 16.
 *
 * SOBREPOSIÇÃO DE DADOS COM OUTROS EPICS (investigada nesta rodada, ver
 * comentário de cada tool para o detalhe): `search_web_vehicles` (US-070)
 * vs. `search_vehicles` (US-008/Epic 2) e `get_vehicle_status` (US-074) vs.
 * `get_vehicle_current_location` (US-013/Epic 3) — achados documentados,
 * nenhuma tool foi consolidada ou descartada (decisão de Produto/Engenharia,
 * não desta implementação).
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as WebVehiclesToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
