/**
 * Helpers compartilhados pelas 13 tools do domínio Equipments, Getrak Web
 * (Epic 21, Release 3, novo 19/08/2026 — US-090 a US-102), deliberadamente
 * distinto de `equipments` (Epic 4, US-020/US-021, `EquipmentsIntegracao`/
 * `oauth2ClientCredentials`, `GET /v0.2/equipamentos/integracao`) — mesma
 * convenção de nomenclatura já usada para `web_users` vs. `accounts` e
 * `web_vehicles` vs. `vehicles`. Os 13 endpoints usam `oauth2Password`/
 * `GetrakWeb` (token delegado — ver `domain/getrak-web-shared.ts`),
 * confirmados individualmente contra `reference/openapi.json` (nenhum é
 * `deprecated`) e, adicionalmente, contra chamada real em homologação nesta
 * rodada (ver comentário de cada tool).
 *
 * A tag `Equipments` do openapi.json também documenta operações de
 * ESCRITA — `DELETE /v1.0/equipments/{serial_number}`, `POST`/`PUT
 * /v1.0/equipments/devices`, `POST`/`PUT`/`DELETE /v1.0/equipments/tags`
 * (+ `/{id}`) e `POST /v1.0/equipments/files` (upload de arquivo de
 * importação) — confirmado por inspeção completa da tag antes de
 * codificar; NENHUMA delas foi implementada aqui, conforme instruído.
 *
 * PAGINAÇÃO — achado central desta rodada, com TRÊS estilos reais
 * distintos confirmados entre os 13 endpoints (a tarefa pediu
 * explicitamente para não assumir um padrão único):
 *   1. **`page`/`per_page` nativo** (`/equipments`, `/equipments/carriers`,
 *      `/equipments/inventory`, `/equipments/device-models`,
 *      `/equipments/files`, `/equipments/files/{id}/items`) — o MESMO bug
 *      `perPage`/`per_page` já visto em todo o resto do domínio Getrak Web
 *      (Epic 10/16/17/18/19/13) reproduz aqui também: `perPage` é
 *      silenciosamente ignorado, `per_page` é o nome real. Implementado
 *      com `per_page` desde o início em todos os 6.
 *   2. **Objeto agregado único, sem paginação** (`/equipments/summary`,
 *      `/equipments/inventory-summary`, `/equipments/files/{id}/summary`)
 *      — resposta é um único objeto, não uma lista.
 *   3. **SEM PAGINAÇÃO NATIVA NENHUMA — achado crítico** (`/equipments/
 *      devices`, `/equipments/tags`): confirmado empiricamente que `page`,
 *      `per_page`, `perPage`, `limit` e `offset` são TODOS ignorados —
 *      o endpoint sempre retorna a lista COMPLETA, sem nenhum corte. Em
 *      `/equipments/devices`, isso significa retornar TODOS os ~18.200
 *      equipamentos da central (~9 MB) em toda chamada, mesmo com filtro
 *      nenhum. Tratado com `createClientSideSliceAdapter`
 *      (`foundation/pagination/pagination.ts`) — o mesmo padrão já usado
 *      em `get_centrals` (Epic 9) para o mesmo problema — que corta a
 *      lista no lado do MCP para respeitar o guardrail de página/tamanho
 *      (CLAUDE.md Seção 4). Isso NÃO elimina o custo real de rede/memória
 *      de buscar a lista inteira a cada chamada — é uma limitação real do
 *      endpoint upstream, sinalizada explicitamente via `warnings` na
 *      resposta de `search_equipment_devices`, não escondida do consumidor.
 *
 * Detalhe/endpoints de item único (`get_web_equipment_details`,
 * `get_equipment_tag_details`, `get_equipment_import_items`/`_summary` por
 * id) confirmados com HTTP 404 limpo e mensagem específica quando a
 * entidade não existe — mapeados para códigos de domínio via
 * `notFoundCode` (`callGetrakWebEndpoint`/`ApiCoreClient.get`), nunca
 * repassando o erro bruto.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as WebEquipmentsToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
export { createClientSideSliceAdapter, normalizePagination } from "../../foundation/pagination/pagination.js";
