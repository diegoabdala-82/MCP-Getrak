/**
 * US-014 — Consultar histórico de localização de um veículo.
 * Endpoint: GET /v0.1/recebidos/{id}/{dataIni}/{dataFim} (v0.1, vigente,
 * oauth2Password/PublicoCliente). Confirmado contra reference/openapi.json:
 * `id`, `dataIni`, `dataFim` são parâmetros de PATH (não query), todos
 * obrigatórios; a resposta é um array de pacotes de localização — o
 * endpoint não tem nenhum parâmetro de paginação nativo.
 *
 * GAP-003 (Backlog, Open): limite máximo de amplitude do intervalo de datas
 * não definido no PRD. Aplicado, como guardrail mínimo até definição
 * adicional, a paginação padrão do MCP (US-004) via corte client-side
 * (`createClientSideSliceAdapter`) — não elimina o risco de uma janela de
 * datas muito ampla gerar um payload upstream grande antes do corte, mas
 * garante que a tool nunca devolve mais que o limite de página ao agente.
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

const SOURCE_ENDPOINT = "GET /v0.1/recebidos/{id}/{dataIni}/{dataFim}";

export const getVehicleLocationHistoryInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().min(1, "vehicle_id is required"),
  start_date: dateTimeSchema,
  end_date: dateTimeSchema,
  ...paginationInputShape,
});

export type GetVehicleLocationHistoryInput = z.infer<typeof getVehicleLocationHistoryInputSchema>;

export interface GetVehicleLocationHistoryData {
  history: Record<string, unknown>[];
  pagination: ReturnType<typeof normalizePagination> & { total_items: number | null; has_more: boolean | null };
}

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []),
});

export function createGetVehicleLocationHistoryTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetVehicleLocationHistoryInput, GetVehicleLocationHistoryData> {
  const definition: ToolDefinition<GetVehicleLocationHistoryInput, GetVehicleLocationHistoryData> = {
    name: "get_vehicle_location_history",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleLocationHistoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: buildDateRangePath("/v0.1/recebidos", input.vehicle_id, input.start_date, input.end_date),
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw as Record<string, unknown>, pagination);

      return {
        data: { history: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_location_history",
      description: "Get the location history of a vehicle within a date range.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
