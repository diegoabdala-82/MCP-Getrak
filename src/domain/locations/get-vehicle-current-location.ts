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
 * veículo).
 *
 * CONFIRMADO em teste real contra produção (2026-08-14, central
 * "apresentacao", mesmo veículo, duas chamadas sucessivas): a resposta é
 * `{page, pages, tema_central, total, veiculos}`, mas `veiculos` NÃO é o
 * registro plano único que o schema do openapi.json documenta — e a forma
 * observada nem é sempre a mesma entre chamadas: já foi vista tanto como
 * array (`[{...campos do veículo...}]`, forma mais comum) quanto como objeto
 * indexado numericamente (`{"0": {...}}`), para exatamente o mesmo veículo e
 * central. Consistente com o alerta do PRD/Contexto sobre "objetos
 * inconsistentes" na API Core (provável artefato de serialização de array
 * associativo no backend). Tratado defensivamente cobrindo as três formas:
 * array, objeto com chaves puramente numéricas, e registro plano direto
 * (formato documentado, não observado ainda mas mantido como fallback).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
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
  veiculos?: Record<string, unknown> | unknown[] | null;
}

const NUMERIC_KEY_PATTERN = /^\d+$/;

/**
 * Extrai o registro de localização de `veiculos`, cobrindo as três formas
 * observadas/documentadas (ver comentário no topo do arquivo): array,
 * objeto indexado numericamente, e registro plano direto.
 */
function extractLocationRecord(veiculos: unknown): Record<string, unknown> | null {
  if (!veiculos || typeof veiculos !== "object") {
    return null;
  }

  if (Array.isArray(veiculos)) {
    const first = veiculos[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  const obj = veiculos as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return null;
  }

  const firstKey = keys[0];
  if (firstKey !== undefined && keys.every((key) => NUMERIC_KEY_PATTERN.test(key))) {
    const first = obj[firstKey];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  return obj;
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

      const record = extractLocationRecord(raw.veiculos);
      const location = record ? normalizeItem(record) : null;

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
