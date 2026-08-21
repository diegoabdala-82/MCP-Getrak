/**
 * US-066 — Consultar itens de importação de entidade.
 * Endpoint: GET /v1.0/clients/import-entity/{id}/items (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Mesma avaliação de
 * utilidade real de `search_entity_import_requests` (US-064) se aplica.
 *
 * ACHADO CRÍTICO — id inexistente retorna HTTP 500, NÃO HTTP 404, ao
 * contrário de `get_entity_import_details` (US-065) para o mesmo conceito
 * de "requisição de importação inexistente":
 *   - `get_entity_import_details` (`/v1.0/clients/import-entity/{id}`):
 *     HTTP 404, `{"error":"import not found"}`.
 *   - `get_entity_import_items` (este arquivo,
 *     `/v1.0/clients/import-entity/{id}/items`): HTTP 500,
 *     `{"status":500,"error":"Import entity with id 999999 not
 *     found."}` — um erro de servidor genérico para o MESMO cenário
 *     conceitual (id de importação que não existe).
 *   - **Isso ainda é tratado corretamente sem código extra**, graças ao
 *     comportamento já existente de `normalizeUpstreamHttpError`
 *     (`foundation/errors/error-normalizer.ts`): qualquer status HTTP que
 *     não seja 404/401/403/429/5xx-transiente (502/503/504) cai no branch
 *     final, que usa `domainCode ?? UPSTREAM_ERROR` — ou seja, um HTTP 500
 *     com `notFoundCode: "ENTITY_IMPORT_NOT_FOUND"` já mapeia
 *     corretamente para `ENTITY_IMPORT_NOT_FOUND`, o mesmo código usado
 *     pelo 404 limpo de US-065. Esse é o MESMO tradeoff já aceito e
 *     documentado em `get_user_details` (Epic 16) e `get_vehicle_by_plate`
 *     (Epic 17): um HTTP 500 genuinamente não relacionado a "não
 *     encontrado" também seria mapeado para `ENTITY_IMPORT_NOT_FOUND` por
 *     esse mesmo mecanismo — aceito conscientemente, não uma omissão.
 *
 * Confirmado contra chamada real em homologação nesta rodada (id real
 * `55`, com 1 item, status `failure`):
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`.
 *   - `filters[status][eq]=failure` confirmado funcionando (reduziu para
 *     exatamente o item com esse status).
 *   - `order[name]=ASC` confirmado funcionando via o próprio
 *     `x-codeSamples` do openapi.json. Dos muitos `order[x]` documentados
 *     (mais de 20), expostos aqui só os mais úteis para diagnóstico
 *     (`id`, `name`, `document`, `status`, `created_at`) — os demais não
 *     testados individualmente nesta rodada, não expostos para não
 *     assumir que todos funcionam sem verificação.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callGetrakWebEndpoint,
  centralSchema,
  extractPagePerPageEnvelope,
  normalizeItem,
  paginationInputShape,
  type WebClientsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/clients/import-entity/{id}/items";

const SORTABLE_FIELDS = ["id", "name", "document", "status", "created_at"] as const;

export const getEntityImportItemsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
  search: z.string().optional(),
  status: z.enum(["failure", "pending", "success"]).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type GetEntityImportItemsInput = z.infer<typeof getEntityImportItemsInputSchema>;

export interface GetEntityImportItemsData {
  items: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createGetEntityImportItemsTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<GetEntityImportItemsInput, GetEntityImportItemsData> {
  const definition: ToolDefinition<GetEntityImportItemsInput, GetEntityImportItemsData> = {
    name: "get_entity_import_items",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEntityImportItemsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: `/v1.0/clients/import-entity/${input.id}/items`,
        query: {
          "filters[search][inc]": input.search,
          "filters[status][eq]": input.status,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "ENTITY_IMPORT_NOT_FOUND",
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { items: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_entity_import_items",
      description: "Get the line items (and their success/failure status) of a specific bulk client/subclient import job within an authorized central.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
