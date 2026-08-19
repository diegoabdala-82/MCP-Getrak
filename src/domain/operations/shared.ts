/**
 * Helpers compartilhados pela tool do domínio Operations (Epic 19, Release
 * 3, novo 19/08/2026 — US-079, único endpoint de leitura). Usa
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`), confirmado contra `reference/openapi.json`
 * (não `deprecated`) e, adicionalmente, contra chamada real em homologação
 * nesta rodada (ver comentário de `search-operations.ts`).
 *
 * A tag `Operations` do openapi.json documenta só este único endpoint
 * (`GET /v1.0/operations`) — nenhum outro path usa essa tag neste
 * `openapi.json`, então não há risco de confundir esta tool com uma
 * operação de escrita adjacente na mesma tag (a preocupação sinalizada na
 * tarefa). O próprio endpoint tem `"x-internal": true` no openapi.json —
 * sinalizado aqui por transparência (não visto em nenhum outro endpoint já
 * consumido pelo projeto até agora), mas nenhuma fonte de verdade (CLAUDE.md,
 * PRD, Technical Brief, spec da US-079) trata `x-internal` como bloqueio de
 * implementação — só a flag `deprecated` é o critério de vigência (CLAUDE.md
 * Seção 7). Não interpretado como impedimento.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as OperationsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
