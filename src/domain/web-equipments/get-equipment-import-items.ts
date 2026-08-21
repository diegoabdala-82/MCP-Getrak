/**
 * US-101 — Consultar itens de importação de equipamento.
 * Endpoint: GET /v1.0/equipments/files/{id}/items (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Drill-down de
 * `search_equipment_import_requests` (US-100) — mesma avaliação de
 * utilidade real se aplica (ver comentário daquele arquivo): permite
 * responder "quais linhas específicas desta importação falharam, e por
 * quê" via `filters[status][eq]=failure`.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` — implementado com
 *     `per_page` desde o início.
 *   - Id de importação existente (`126`): HTTP 200, itens reais
 *     (`{id, equipment_import_id, file_line, serial_number}` — os campos
 *     `error`/`status`/demais documentados não vieram populados nesta
 *     amostra real, possivelmente `null`/omitidos quando não aplicável).
 *   - `filters[status][eq]=failure` confirmado funcionando (reduziu de 4
 *     para 2 itens, exatamente os 2 que também apareciam como
 *     `failures: 2` em `get_equipment_import_summary` para o mesmo id).
 *   - Id de importação inexistente (`999999`): HTTP 404 limpo,
 *     `{"error":"Equipment import not found"}` — mapeado para
 *     `EQUIPMENT_IMPORT_NOT_FOUND` via `notFoundCode`.
 *   - Dos muitos `order[x]` documentados, expostos aqui os mais úteis para
 *     diagnóstico (`file_line`, `serial_number`, `status`) — os demais
 *     (`device_number`, `sim_carrier_name`, `sim_card_number`,
 *     `phone_number`, `apn`, `error`) não testados individualmente nesta
 *     rodada; não expostos para não assumir que todos funcionam sem
 *     verificação (mesma disciplina do resto do projeto).
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
  type WebEquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/files/{id}/items";

const SORTABLE_FIELDS = ["file_line", "serial_number", "status"] as const;

export const getEquipmentImportItemsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
  search: z.string().optional(),
  status: z.string().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type GetEquipmentImportItemsInput = z.infer<typeof getEquipmentImportItemsInputSchema>;

export interface GetEquipmentImportItemsData {
  items: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createGetEquipmentImportItemsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetEquipmentImportItemsInput, GetEquipmentImportItemsData> {
  const definition: ToolDefinition<GetEquipmentImportItemsInput, GetEquipmentImportItemsData> = {
    name: "get_equipment_import_items",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEquipmentImportItemsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: `/v1.0/equipments/files/${input.id}/items`,
        query: {
          "filters[search][inc]": input.search,
          "filters[status][eq]": input.status,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "EQUIPMENT_IMPORT_NOT_FOUND",
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
      name: "get_equipment_import_items",
      description: "Get the line items (and their success/failure status) of a specific bulk equipment import job within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
