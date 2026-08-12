/**
 * US-011 — Consultar vínculo entre veículo e subcliente.
 * Endpoint: GET /v0.2/veiculos/subclientes/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais
 * `sistema, id_veiculo, subcliente, limit, offset`; resposta é array de
 * `{placa, id_veiculo, modulo, subcliente}`.
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

const SOURCE_ENDPOINT = "GET /v0.2/veiculos/subclientes/integracao";

export const getVehicleSubclientLinkInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().optional(),
  subclient_id: z.string().optional(),
  ...paginationInputShape,
});

export type GetVehicleSubclientLinkInput = z.infer<typeof getVehicleSubclientLinkInputSchema>;

export interface GetVehicleSubclientLinkData {
  links: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createGetVehicleSubclientLinkTool(
  deps: VehiclesToolDeps,
): DomainToolRegistration<GetVehicleSubclientLinkInput, GetVehicleSubclientLinkData> {
  const definition: ToolDefinition<GetVehicleSubclientLinkInput, GetVehicleSubclientLinkData> = {
    name: "get_vehicle_subclient_link",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleSubclientLinkInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limit");

      const raw = await callVehiclesEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/veiculos/subclientes/integracao",
        query: {
          id_veiculo: input.vehicle_id,
          subcliente: input.subclient_id,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const links = extractArray(raw).map(normalizeItem);

      return {
        data: {
          links,
          pagination: buildPaginationMeta(links, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_subclient_link",
      description: "Get the link between a vehicle and its subclient within an authorized central.",
      intent: "read",
      domain: "vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
