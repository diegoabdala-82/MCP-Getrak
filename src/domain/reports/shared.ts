/**
 * Helpers compartilhados pelas tools do domínio Reports (Epic 13, Release
 * 3, novo 19/08/2026 — US-049, US-050). Usa `oauth2Password`/`GetrakWeb`
 * (token delegado — ver `domain/getrak-web-shared.ts`), confirmado contra
 * `reference/openapi.json` (nenhum dos 2 endpoints é `deprecated`) e,
 * adicionalmente, contra chamada real em homologação nesta rodada (ver
 * comentário de cada tool).
 *
 * A tag `Reports` do openapi.json também documenta operações de ESCRITA
 * (`POST /v1.0/report/reports`, `POST /v1.0/report/reports/share`,
 * `PUT`/`DELETE /v1.0/report/reports/report-scheduling/{id}`,
 * `DELETE /v1.0/report/reports/{reportId}`) — confirmado via inspeção
 * completa da tag antes de codificar; NENHUMA delas foi implementada aqui,
 * conforme instruído. Só os 2 endpoints de leitura (`GET /v1.0/report/
 * reports` e `GET /v1.0/report/reports/summary`) fazem parte deste domínio.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as ReportsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
