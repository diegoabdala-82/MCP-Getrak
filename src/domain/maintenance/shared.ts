/**
 * Helpers compartilhados pelas 10 tools do domínio Maintenance (Epic 14,
 * Release 3, novo 20/08/2026 — US-051 a US-060). Domínio novo — não existe
 * um equivalente `oauth2ClientCredentials`/`Integracao` deste domínio em
 * nenhum epic anterior do projeto, então o nome do domínio no catálogo é
 * `maintenance` (sem prefixo `web_`), mesma convenção já usada para
 * `operations`/`reports`/`notifications` (domínios GetrakWeb sem
 * contraparte técnica a desambiguar). Os 10 endpoints usam
 * `oauth2Password`/`GetrakWeb` (token delegado — ver
 * `domain/getrak-web-shared.ts`), todos `v2.0` (confirmado no
 * `openapi.json`: nenhum é `deprecated` — diferente de outros epics
 * anteriores, aqui não há nenhum equivalente `v0.x`/`v1.0` a evitar).
 *
 * A tag `Maintenance` do openapi.json também documenta operações de
 * ESCRITA — `POST`/`PUT`/`DELETE /v2.0/maintenance/fuel-supply(/{id})`,
 * `POST`/`PUT`/`DELETE /v2.0/maintenance/maintenances(/{id})`,
 * `POST /v2.0/maintenance/maintenances/bulk-remove`,
 * `POST /v2.0/maintenance/maintenances/{id}/finish`,
 * `POST`/`PATCH`/`DELETE /v2.0/maintenance/services(/{id})`,
 * `POST /v2.0/maintenance/services/bulk-remove`,
 * `PATCH /v2.0/maintenance/services/bulk-update/status` e
 * `POST /v2.0/maintenance/attachments/upload-url` — confirmado por
 * inspeção completa da tag antes de codificar; NENHUMA delas foi
 * implementada aqui, conforme instruído.
 *
 * PAGINAÇÃO — confirmado empiricamente que este domínio tem pelo menos
 * DOIS estilos reais de envelope de lista, diferente entre si:
 *   1. `{data, page, pages, total}` (o padrão já visto em todo o resto do
 *      domínio Getrak Web) — usado por `/v2.0/maintenance/fuel-supply` e
 *      `/v2.0/maintenance/maintenances`. Mesmo bug `perPage`/`per_page` de
 *      sempre (`perPage` ignorado, `per_page` respeitado).
 *   2. **Achado crítico, novo neste domínio** — `/v2.0/maintenance/
 *      services` usa um envelope ANINHADO e com nomes de chave diferentes:
 *      `{data, pagination: {total, page, itemsPerPage, totalPages}}` (não
 *      documentado exatamente assim — o `openapi.json` documenta
 *      `items_per_page`/`total_pages`, mas a resposta real usa
 *      `itemsPerPage`/`totalPages`, camelCase). O NOME DO PARÂMETRO DE
 *      QUERY continua sendo `per_page` (confirmado empiricamente — nem
 *      `perPage` nem `items_per_page` têm efeito) — só o formato da
 *      RESPOSTA é diferente; `extractPagePerPageEnvelope` (que espera
 *      `{data, page, pages, total}` no nível raiz) não se aplica a este
 *      endpoint, tratado com uma extração local em `search-maintenance-
 *      services.ts`.
 *
 * BUNDLE DE ANEXOS (US-054/US-060) — decisão registrada, ver comentário de
 * cabeçalho de `get-fuel-supply-attachments.ts`/`get-maintenance-
 * attachments.ts` para o racional completo: mantidos como TOOLS
 * SEPARADAS, não bundled dentro de `get_fuel_supply_details`/
 * `get_maintenance_details`.
 */

export { GETRAK_WEB_AUTH_SCHEME, GETRAK_WEB_SCOPE, callGetrakWebEndpoint } from "../getrak-web-shared.js";
export type { GetrakWebToolDeps as MaintenanceToolDeps } from "../getrak-web-shared.js";
export {
  centralSchema,
  paginationInputShape,
  normalizeItem,
  extractPagePerPageEnvelope,
  buildPagePerPagePagination,
} from "../shared.js";
export { normalizePagination } from "../../foundation/pagination/pagination.js";
