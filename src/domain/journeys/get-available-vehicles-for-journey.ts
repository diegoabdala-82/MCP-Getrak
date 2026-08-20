/**
 * US-088 — Consultar veículos disponíveis para vínculo de viagem.
 * Endpoint: GET /v1.0/journeys/vehicles/available (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * ACHADO — confirmado que este endpoint NÃO PAGINA sob nenhuma convenção
 * testada (`page`, `per_page`) — sempre retorna a lista completa
 * (`{data: [...]}`, sem `page`/`pages`/`total` na resposta; 43 itens nesta
 * central de demonstração). Mesmo tratamento já usado em `get_centrals`/
 * `search_equipment_tags`: `createClientSideSliceAdapter` — busca a lista
 * completa e corta client-side para respeitar o contrato padronizado de
 * página/tamanho do MCP, com a limitação sinalizada via `warnings`.
 *
 * `include[]=drivers` confirmado funcionando (adiciona um array de
 * motoristas disponíveis por veículo).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  callGetrakWebEndpoint,
  centralSchema,
  createClientSideSliceAdapter,
  normalizeItem,
  normalizePagination,
  paginationInputShape,
  type JourneysToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/vehicles/available";

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw.data) ? (raw.data as Record<string, unknown>[]) : []),
});

export const getAvailableVehiclesForJourneyInputSchema = z.object({
  central: centralSchema,
  has_identifier: z.boolean().optional(),
  include_drivers: z.boolean().optional(),
  ...paginationInputShape,
});

export type GetAvailableVehiclesForJourneyInput = z.infer<typeof getAvailableVehiclesForJourneyInputSchema>;

export interface GetAvailableVehiclesForJourneyData {
  vehicles: Record<string, unknown>[];
  pagination: ReturnType<typeof sliceAdapter.fromUpstreamResponse>["meta"];
}

export function createGetAvailableVehiclesForJourneyTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetAvailableVehiclesForJourneyInput, GetAvailableVehiclesForJourneyData> {
  const definition: ToolDefinition<GetAvailableVehiclesForJourneyInput, GetAvailableVehiclesForJourneyData> = {
    name: "get_available_vehicles_for_journey",
    risk: "low",
    requiresCentral: true,
    inputSchema: getAvailableVehiclesForJourneyInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/journeys/vehicles/available",
        query: {
          "filters[has_identifier]": input.has_identifier,
          "include[]": input.include_drivers ? ["drivers"] : undefined,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw, pagination);

      return {
        data: { vehicles: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
        warnings: [
          "This upstream endpoint does not support server-side pagination (confirmed) — every call fetches " +
            "the entire available-vehicles list for the central internally before slicing it to the requested page.",
        ],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_available_vehicles_for_journey",
      description: "List vehicles available to be linked to a new journey within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
