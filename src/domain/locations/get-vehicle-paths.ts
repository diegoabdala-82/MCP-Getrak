/**
 * US-015 — Consultar trajetos de um veículo em um período.
 * Endpoint: GET /v0.1/trajetos/{id}/{dataIni}/{dataFim} (v0.1, vigente,
 * oauth2Password/PublicoCliente). Parâmetros de path obrigatórios
 * (id/dataIni/dataFim); resposta é array de pontos de trajeto
 * (`data, lat, lon, status_online, velocidade`); sem paginação nativa —
 * mesmo tratamento de US-014 (corte client-side, GAP-003).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { createClientSideSliceAdapter, normalizePagination } from "../../foundation/pagination/pagination.js";
import {
  buildDateRangePath,
  callLocationsEndpoint,
  centralSchema,
  dateTimeSchema,
  normalizeItem,
  paginationInputShape,
  type LocationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.1/trajetos/{id}/{dataIni}/{dataFim}";

export const getVehiclePathsInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().min(1, "vehicle_id is required"),
  start_date: dateTimeSchema,
  end_date: dateTimeSchema,
  ...paginationInputShape,
});

export type GetVehiclePathsInput = z.infer<typeof getVehiclePathsInputSchema>;

export interface GetVehiclePathsData {
  paths: Record<string, unknown>[];
  pagination: ReturnType<typeof normalizePagination> & { total_items: number | null; has_more: boolean | null };
}

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []),
});

export function createGetVehiclePathsTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetVehiclePathsInput, GetVehiclePathsData> {
  const definition: ToolDefinition<GetVehiclePathsInput, GetVehiclePathsData> = {
    name: "get_vehicle_paths",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehiclePathsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: buildDateRangePath("/v0.1/trajetos", input.vehicle_id, input.start_date, input.end_date),
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw as Record<string, unknown>, pagination);

      return {
        data: { paths: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_paths",
      description: "Get the paths traveled by a vehicle within a date range.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
