/**
 * US-021 — Consultar posição de bancada de um equipamento.
 * Endpoint: GET /v0.2/equipamentos/integracao/posicaobancada/{modulo}
 * (v0.2, vigente, oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: `modulo` é parâmetro de PATH; resposta é array de
 * `{d, dia, hora, id}` (posições de bancada). Sem parâmetro de central
 * (`sistema`) — confirmado que este endpoint de lookup por identificador
 * específico não o aceita, mesmo padrão de get_vehicle_category.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callEquipmentsEndpoint, centralSchema, normalizeItem, type EquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/equipamentos/integracao/posicaobancada/{modulo}";

export const getEquipmentBenchPositionInputSchema = z.object({
  central: centralSchema,
  module: z.string().min(1, "module is required"),
});

export type GetEquipmentBenchPositionInput = z.infer<typeof getEquipmentBenchPositionInputSchema>;

export interface GetEquipmentBenchPositionData {
  positions: Record<string, unknown>[];
}

export function createGetEquipmentBenchPositionTool(
  deps: EquipmentsToolDeps,
): DomainToolRegistration<GetEquipmentBenchPositionInput, GetEquipmentBenchPositionData> {
  const definition: ToolDefinition<GetEquipmentBenchPositionInput, GetEquipmentBenchPositionData> = {
    name: "get_equipment_bench_position",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEquipmentBenchPositionInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callEquipmentsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: `/v0.2/equipamentos/integracao/posicaobancada/${encodeURIComponent(input.module)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const positions = (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).map(normalizeItem);

      return {
        data: { positions },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_equipment_bench_position",
      description: "Get the registered bench positions of an equipment module.",
      intent: "read",
      domain: "equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
