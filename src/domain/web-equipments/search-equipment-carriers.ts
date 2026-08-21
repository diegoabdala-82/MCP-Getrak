/**
 * US-094 — Buscar transportadoras.
 * Endpoint: GET /v1.0/equipments/carriers (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Nome do endpoint ("carriers") e o campo de
 * resposta (`apn`) deixam claro que se trata de OPERADORAS DE TELEFONIA
 * (carriers de SIM/chip — OI, VIVO, TIM, CLARO, etc.), não transportadoras
 * de carga/logística, apesar do nome em português da User Story ("buscar
 * transportadoras"); a tool e a descrição usam "carriers" no sentido
 * técnico confirmado pela resposta real, não uma tradução literal do nome
 * da User Story.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Dataset pequeno e estático nesta central (6 operadoras: OI, VIVO,
 *     TIM, CLARO, SERCONTEL, CTBC).
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: `perPage=2` retornou os
 *     6 itens completos (ignorado); `per_page=2` retornou 2 itens
 *     corretamente. Implementado com `per_page` desde o início.
 *   - `filters[name]` confirmado funcionando (`VIVO` → 1 resultado exato).
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

const SOURCE_ENDPOINT = "GET /v1.0/equipments/carriers";

export const searchEquipmentCarriersInputSchema = z.object({
  central: centralSchema,
  name: z.string().optional(),
  ...paginationInputShape,
});

export type SearchEquipmentCarriersInput = z.infer<typeof searchEquipmentCarriersInputSchema>;

export interface SearchEquipmentCarriersData {
  carriers: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchEquipmentCarriersTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchEquipmentCarriersInput, SearchEquipmentCarriersData> {
  const definition: ToolDefinition<SearchEquipmentCarriersInput, SearchEquipmentCarriersData> = {
    name: "search_equipment_carriers",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEquipmentCarriersInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/equipments/carriers",
        query: {
          "filters[name]": input.name,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { carriers: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_equipment_carriers",
      description: "Search mobile carriers (SIM/chip network operators, e.g. Vivo, Claro, Tim) within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
