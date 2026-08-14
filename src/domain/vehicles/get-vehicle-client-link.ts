/**
 * US-010 — Consultar vínculo entre veículo e cliente.
 * Endpoint: GET /v0.2/veiculos/clientes/integracao (v0.2, vigente,
 * confirmado ED-03: Closed — substitui integralmente o v0.1 depreciado).
 * Confirmado contra reference/openapi.json: query params reais
 * `sistema, id_veiculo, cliente, limit, offset` (aqui "limit" em inglês —
 * diferente de "limite" usado por /v0.2/veiculos/integracao, exatamente o
 * tipo de heterogeneidade que ED-01 previu); resposta é array de
 * `{placa, id_veiculo, cliente, modulo, nome, cpfCnpj}`.
 *
 * `cpfCnpj` é dado sensível (CLAUDE.md Seção 8) — mascarado apenas na
 * auditoria (US-005), nunca na resposta normalizada em si (a tool retorna o
 * dado ao consumidor autorizado; mascaramento de resposta ao consumidor
 * final não está no escopo desta spec nem do envelope US-003).
 *
 * CORRIGIDO (ver search-vehicles.ts para o achado completo): `sistema` é
 * central, confirmado por consistência com ~40 outras rotas "integracao" no
 * openapi.json — enviado explicitamente agora.
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

const SOURCE_ENDPOINT = "GET /v0.2/veiculos/clientes/integracao";

export const getVehicleClientLinkInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.string().optional(),
  client_id: z.string().optional(),
  ...paginationInputShape,
});

export type GetVehicleClientLinkInput = z.infer<typeof getVehicleClientLinkInputSchema>;

export interface GetVehicleClientLinkData {
  links: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createGetVehicleClientLinkTool(
  deps: VehiclesToolDeps,
): DomainToolRegistration<GetVehicleClientLinkInput, GetVehicleClientLinkData> {
  const definition: ToolDefinition<GetVehicleClientLinkInput, GetVehicleClientLinkData> = {
    name: "get_vehicle_client_link",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleClientLinkInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limit");

      const raw = await callVehiclesEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/veiculos/clientes/integracao",
        query: {
          sistema: input.central,
          id_veiculo: input.vehicle_id,
          cliente: input.client_id,
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
      name: "get_vehicle_client_link",
      description: "Get the link between a vehicle and its client within an authorized central.",
      intent: "read",
      domain: "vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
