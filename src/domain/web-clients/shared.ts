/**
 * Helpers compartilhados pelas 6 tools do domínio Clients, Getrak Web
 * (Epic 15, Release 3, novo 19/08/2026 — US-061 a US-066), deliberadamente
 * distinto de `accounts`/`search_clients` (Epic 9, US-030,
 * `ClientsIntegracao`/`oauth2ClientCredentials`, `GET /v0.2/clientes/
 * integracao`) — mesma convenção de nomenclatura de `web_users` vs.
 * `accounts`, `web_vehicles` vs. `vehicles` e `web_equipments` vs.
 * `equipments`. Os 6 endpoints usam `oauth2Password`/`GetrakWeb` (token
 * delegado — ver `domain/getrak-web-shared.ts`), confirmados
 * individualmente contra `reference/openapi.json` (nenhum é `deprecated`)
 * e, adicionalmente, contra chamada real em homologação nesta rodada (ver
 * comentário de cada tool).
 *
 * A tag `Clients` do openapi.json também documenta operações de ESCRITA —
 * `PUT /v1.0/clients/{id}/status`, `PUT /v1.0/clients/batch-status`,
 * `PUT /v1.0/clients/subclients/{id}/status`,
 * `PUT /v1.0/clients/subclients/batch-status` (mudança de status de
 * cliente/subcliente, individual e em lote) e
 * `POST /v1.0/clients/import-entity` (upload de arquivo de importação) —
 * confirmado por inspeção completa da tag antes de codificar; NENHUMA
 * delas foi implementada aqui, conforme instruído.
 *
 * PAGINAÇÃO — confirmado empiricamente que os 4 endpoints de lista deste
 * domínio (`/v1.0/client`, `/v1.0/clients/import-entity`,
 * `/v1.0/clients/import-entity/{id}/items`) usam `page`/`per_page` nativo,
 * reproduzindo o MESMO bug `perPage`/`per_page` de todo o resto do
 * domínio Getrak Web (`perPage` silenciosamente ignorado, `per_page`
 * respeitado). Os 2 endpoints de resumo (`/v1.0/clients/summary`,
 * `/v1.0/clients/subclients/summary`) não paginam — objeto agregado
 * único. `/v1.0/clients/import-entity/{id}` é item único por id.
 *
 * ACHADO — formato de wire do filtro `filters[id][in]` em `GET
 * /v1.0/client` exige o sufixo de array `[]`: confirmado empiricamente
 * que `filters[id][in][]=<id1>&filters[id][in][]=<id2>` filtra
 * corretamente (total exato = 2 para 2 ids reais), enquanto omitir o `[]`
 * (`filters[id][in]=<id1>&filters[id][in]=<id2>`, chave repetida) faz o
 * filtro ser SILENCIOSAMENTE IGNORADO (retorna o total não filtrado,
 * 2102). Mesmo padrão do Epic 19 (`/v1.0/operations`), OPOSTO do Epic 13
 * (`/v1.0/report/reports`) — reforça, mais uma vez, que cada endpoint
 * precisa ser validado individualmente.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as WebClientsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
