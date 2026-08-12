/**
 * US-013 — Consultar última localização conhecida de um veículo.
 * Endpoint: GET /v0.1/localizacoes (v0.1, vigente — sem versão posterior na
 * OpenAPI Core, critério exclusivamente a flag `deprecated`, confirmado em
 * reference/openapi.json), oauth2Password, escopo PublicoCliente.
 *
 * Confirmado contra reference/openapi.json: `id` (query, obrigatório,
 * integer) filtra para um único veículo; `page`/`per_page` também existem
 * no endpoint mas não fazem sentido para "localização atual de UM veículo"
 * (provavelmente reaproveitados de um endpoint de listagem mais genérico) —
 * não expostos nesta tool, conforme a spec (entrada: apenas identificador de
 * veículo). Resposta: objeto `{page, pages, tema_central, total, veiculos}`,
 * onde `veiculos` é o registro de localização do veículo (não uma lista).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { normalizeNullable } from "../../foundation/envelope/response-envelope.js";
import {
  callLocationsEndpoint,
  centralSchema,
  normalizeItem,
  type LocationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.1/localizacoes";

export const getVehicleCurrentLocationInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().min(1, "vehicle_id is required"),
});

export type GetVehicleCurrentLocationInput = z.infer<typeof getVehicleCurrentLocationInputSchema>;

export interface GetVehicleCurrentLocationData {
  /** `null` quando o veículo não possui localização disponível (AC de US-013 — não é erro). */
  location: Record<string, unknown> | null;
}

interface RawLocationsResponse {
  veiculos?: Record<string, unknown> | null;
}

function hasUsableLocation(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.keys(value).length > 0;
}

export function createGetVehicleCurrentLocationTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetVehicleCurrentLocationInput, GetVehicleCurrentLocationData> {
  const definition: ToolDefinition<GetVehicleCurrentLocationInput, GetVehicleCurrentLocationData> = {
    name: "get_vehicle_current_location",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleCurrentLocationInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<RawLocationsResponse>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.1/localizacoes",
        query: { id: input.vehicle_id },
        environment: ctx.environment,
        central: input.central,
      });

      const location = hasUsableLocation(raw.veiculos) ? normalizeItem(raw.veiculos) : normalizeNullable(null);

      return {
        data: { location },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_current_location",
      description: "Get the last known location of a vehicle (latitude, longitude, speed, ignition/input status, last packet time).",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
