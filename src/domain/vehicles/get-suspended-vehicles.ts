/**
 * US-012 — Consultar veículos suspensos.
 * Endpoint: GET /v0.2/veiculos/integracao/veiculoSuspenderIntegracao (v0.2,
 * vigente, oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais
 * `sistema, id_veiculo, limite, offset, ordem`.
 *
 * O schema de resposta declarado é `type: object` (um único veículo), mas o
 * nome do endpoint (lista de veículos suspensos) e a presença de
 * `limite`/`offset` sugerem fortemente uma lista — tratado defensivamente
 * via `extractArray`, mesma inconsistência documentada em
 * `get-vehicle-category.ts`.
 *
 * CORRIGIDO: a pesquisa original desta US usava um script que não
 * resolvia parâmetros `$ref` no openapi.json, e `sistema` deste endpoint
 * especificamente é declarado via `$ref` — por isso passou despercebido.
 * Sua descrição aqui já era clara ("Central unique identifier"); ao
 * reconferir durante o Epic 4, ficou evidente que era central e nunca
 * estava sendo enviado. Corrigido (ver search-vehicles.ts para o achado
 * completo que também afetou US-008/010/011).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPaginationMeta,
  buildUpstreamPagination,
  callVehiclesEndpoint,
  centralSchema,
  extractArray,
  normalizeItem,
  paginationInputShape,
  type VehiclesToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/veiculos/integracao/veiculoSuspenderIntegracao";

export const getSuspendedVehiclesInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().optional(),
  sort: z.string().optional(),
  ...paginationInputShape,
});

export type GetSuspendedVehiclesInput = z.infer<typeof getSuspendedVehiclesInputSchema>;

export interface GetSuspendedVehiclesData {
  vehicles: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createGetSuspendedVehiclesTool(
  deps: VehiclesToolDeps,
): DomainToolRegistration<GetSuspendedVehiclesInput, GetSuspendedVehiclesData> {
  const definition: ToolDefinition<GetSuspendedVehiclesInput, GetSuspendedVehiclesData> = {
    name: "get_suspended_vehicles",
    risk: "low",
    requiresCentral: true,
    inputSchema: getSuspendedVehiclesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limite");

      const raw = await callVehiclesEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/veiculos/integracao/veiculoSuspenderIntegracao",
        query: {
          sistema: input.central,
          id_veiculo: input.vehicle_id,
          ordem: input.sort,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const vehicles = extractArray(raw).map(normalizeItem);

      return {
        data: {
          vehicles,
          pagination: buildPaginationMeta(vehicles, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_suspended_vehicles",
      description: "List suspended vehicles within an authorized central.",
      intent: "read",
      domain: "vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
