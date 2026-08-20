/**
 * US-065 — Consultar detalhe de importação de entidade.
 * Endpoint: GET /v1.0/clients/import-entity/{id} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Drill-down de
 * `search_entity_import_requests` (US-064) — mesma avaliação de
 * utilidade real se aplica (ver comentário daquele arquivo).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente: HTTP 200, objeto único com o mesmo shape do item de
 *     `search_entity_import_requests` (`{id, central_id, client_id,
 *     entity, file_path, status, total_count, successful_count,
 *     failed_count, user_id, created_at, updated_at}`).
 *   - Id inexistente: HTTP 404 limpo, `{"error":"import not found"}` —
 *     mapeado para `ENTITY_IMPORT_NOT_FOUND` via `notFoundCode`.
 *     **Diferente** de `get_entity_import_items` (US-066) para o mesmo
 *     tipo de id inexistente — ver comentário daquele arquivo, que
 *     retorna HTTP 500 em vez de 404 para o mesmo cenário conceitual.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebClientsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/clients/import-entity/{id}";

export const getEntityImportDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetEntityImportDetailsInput = z.infer<typeof getEntityImportDetailsInputSchema>;

export interface GetEntityImportDetailsData {
  import_request: Record<string, unknown>;
}

export function createGetEntityImportDetailsTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<GetEntityImportDetailsInput, GetEntityImportDetailsData> {
  const definition: ToolDefinition<GetEntityImportDetailsInput, GetEntityImportDetailsData> = {
    name: "get_entity_import_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEntityImportDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/clients/import-entity/${input.id}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "ENTITY_IMPORT_NOT_FOUND",
      });

      return {
        data: { import_request: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_entity_import_details",
      description: "Get details of a specific bulk client/subclient import job within an authorized central.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
