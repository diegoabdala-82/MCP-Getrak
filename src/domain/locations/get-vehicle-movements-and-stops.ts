/**
 * US-016 — Consultar relatório de deslocamentos e paradas.
 * Endpoint: GET /v0.1/deslocamentos/{id}/{dataIni}/{dataFim} (v0.1, vigente,
 * oauth2Password/PublicoCliente). Parâmetros de path obrigatórios
 * (id/dataIni/dataFim); resposta é array de deslocamentos, sem paginação
 * nativa — mesmo tratamento de US-014/US-015 (corte client-side, GAP-003).
 *
 * O item de deslocamento inclui identificadores de motorista (`cpf_motorista`,
 * `id_motorista`, `motorista`, `dispositivo_motorista`) — dados sensíveis
 * (CLAUDE.md Seção 8). Mascarados apenas na auditoria (US-005); a resposta
 * normalizada ao consumidor autorizado preserva o dado, como já estabelecido
 * para `cpfCnpj` em US-010.
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

const SOURCE_ENDPOINT = "GET /v0.1/deslocamentos/{id}/{dataIni}/{dataFim}";

export const getVehicleMovementsAndStopsInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().min(1, "vehicle_id is required"),
  start_date: dateTimeSchema,
  end_date: dateTimeSchema,
  ...paginationInputShape,
});

export type GetVehicleMovementsAndStopsInput = z.infer<typeof getVehicleMovementsAndStopsInputSchema>;

export interface GetVehicleMovementsAndStopsData {
  movements: Record<string, unknown>[];
  pagination: ReturnType<typeof normalizePagination> & { total_items: number | null; has_more: boolean | null };
}

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []),
});

export function createGetVehicleMovementsAndStopsTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetVehicleMovementsAndStopsInput, GetVehicleMovementsAndStopsData> {
  const definition: ToolDefinition<GetVehicleMovementsAndStopsInput, GetVehicleMovementsAndStopsData> = {
    name: "get_vehicle_movements_and_stops",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleMovementsAndStopsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: buildDateRangePath("/v0.1/deslocamentos", input.vehicle_id, input.start_date, input.end_date),
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw as Record<string, unknown>, pagination);

      return {
        data: { movements: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_movements_and_stops",
      description: "Get the movements and stops report of a vehicle within a date range.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
