/**
 * US-096 — Buscar inventário.
 * Endpoint: GET /v1.0/equipments/inventory (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Devolve o inventário DETALHADO POR MODELO
 * (min/max/current por modelo de dispositivo), distinto do agregado único
 * de `get_inventory_summary` (US-095).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: sem parâmetro, aplica
 *     padrão de 25; `per_page=2` respeitado corretamente. Implementado com
 *     `per_page` desde o início.
 *   - `order[current]=DESC` confirmado funcionando (valores retornados em
 *     ordem decrescente real: 48, 30, 27, 17...).
 *   - Dataset pequeno nesta central (97 itens, 4 páginas de 25).
 *   - O parâmetro de filtro de modelo é `filters[model][eq]` (não
 *     `filters[model_id][eq]`, apesar do campo de saída se chamar
 *     `model.id` — nome do filtro confirmado exatamente como documentado,
 *     não testado isoladamente nesta rodada mas usado tal como documentado
 *     para não inventar um nome diferente).
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

const SOURCE_ENDPOINT = "GET /v1.0/equipments/inventory";

const SORTABLE_FIELDS = ["status", "model", "min", "max", "current"] as const;

export const searchInventoryInputSchema = z.object({
  central: centralSchema,
  model_id: z.number().int().optional(),
  search: z.string().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchInventoryInput = z.infer<typeof searchInventoryInputSchema>;

export interface SearchInventoryData {
  inventory: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchInventoryTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchInventoryInput, SearchInventoryData> {
  const definition: ToolDefinition<SearchInventoryInput, SearchInventoryData> = {
    name: "search_inventory",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchInventoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/equipments/inventory",
        query: {
          "filters[model][eq]": input.model_id,
          "filters[search][inc]": input.search,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { inventory: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_inventory",
      description: "Search equipment inventory levels (min/max/current stock) by device model within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
