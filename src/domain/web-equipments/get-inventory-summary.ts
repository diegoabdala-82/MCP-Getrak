/**
 * US-095 — Consultar resumo de inventário.
 * Endpoint: GET /v1.0/equipments/inventory-summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: nenhum
 * parâmetro de request (nem documentado, nem aceito); resposta real
 * `{equipments, accessories, sim_cards}` (contagens agregadas de
 * inventário disponível/em estoque, distinto das contagens por status de
 * `get_equipments_summary`, que conta equipamentos JÁ EM USO/ciclo de
 * vida). Mesma família de dados de `search_inventory` (US-096), conforme
 * a spec — este é o total agregado, aquele é o detalhamento por modelo.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebEquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/inventory-summary";

export const getInventorySummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetInventorySummaryInput = z.infer<typeof getInventorySummaryInputSchema>;

export interface GetInventorySummaryData {
  summary: Record<string, unknown>;
}

export function createGetInventorySummaryTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetInventorySummaryInput, GetInventorySummaryData> {
  const definition: ToolDefinition<GetInventorySummaryInput, GetInventorySummaryData> = {
    name: "get_inventory_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getInventorySummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/equipments/inventory-summary",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      return {
        data: { summary: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_inventory_summary",
      description: "Get aggregated stock counts (equipments, accessories, SIM cards) available in inventory for an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
