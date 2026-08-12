/**
 * US-017 — Consultar relatório de entradas de um veículo.
 * Endpoint: GET /v0.1/entradas/{id}/{dataIni}/{dataFim} (v0.1, vigente,
 * oauth2Password/PublicoCliente). Parâmetros de path obrigatórios
 * (id/dataIni/dataFim). Confirmado contra reference/openapi.json: ao
 * contrário dos demais endpoints de localização, a resposta NÃO é uma lista
 * — é um objeto fixo com até 4 chaves (`"1"` a `"4"`, um relatório por
 * canal de entrada/sensor). Não há paginação aplicável aqui.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { normalizeNullable } from "../../foundation/envelope/response-envelope.js";
import {
  buildDateRangePath,
  callLocationsEndpoint,
  centralSchema,
  dateTimeSchema,
  normalizeItem,
  type LocationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.1/entradas/{id}/{dataIni}/{dataFim}";
const INPUT_CHANNELS = ["1", "2", "3", "4"] as const;

export const getVehicleInputsReportInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().min(1, "vehicle_id is required"),
  start_date: dateTimeSchema,
  end_date: dateTimeSchema,
});

export type GetVehicleInputsReportInput = z.infer<typeof getVehicleInputsReportInputSchema>;

export interface GetVehicleInputsReportData {
  inputs: Record<(typeof INPUT_CHANNELS)[number], Record<string, unknown> | null>;
}

export function createGetVehicleInputsReportTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetVehicleInputsReportInput, GetVehicleInputsReportData> {
  const definition: ToolDefinition<GetVehicleInputsReportInput, GetVehicleInputsReportData> = {
    name: "get_vehicle_inputs_report",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleInputsReportInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<Record<string, unknown>>({
        apiCoreClient: deps.apiCoreClient,
        path: buildDateRangePath("/v0.1/entradas", input.vehicle_id, input.start_date, input.end_date),
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const inputs = Object.fromEntries(
        INPUT_CHANNELS.map((channel) => {
          const value = raw[channel];
          const normalized =
            value && typeof value === "object" ? normalizeItem(value as Record<string, unknown>) : normalizeNullable(null);
          return [channel, normalized];
        }),
      ) as GetVehicleInputsReportData["inputs"];

      return {
        data: { inputs },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_inputs_report",
      description: "Get the inputs/sensors report of a vehicle within a date range.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
