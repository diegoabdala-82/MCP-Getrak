/**
 * US-098 — Consultar detalhe de tag de equipamento.
 * Endpoint: GET /v1.0/equipments/tags/{id} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente: HTTP 200, `{id, value}` (mesmo shape resumido já visto
 *     em `search_equipment_tags`).
 *   - Id inexistente: HTTP 404 limpo, `{"error":"Tag not found"}` —
 *     mapeado para `EQUIPMENT_TAG_NOT_FOUND` via `notFoundCode`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebEquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/tags/{id}";

export const getEquipmentTagDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetEquipmentTagDetailsInput = z.infer<typeof getEquipmentTagDetailsInputSchema>;

export interface GetEquipmentTagDetailsData {
  tag: Record<string, unknown>;
}

export function createGetEquipmentTagDetailsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetEquipmentTagDetailsInput, GetEquipmentTagDetailsData> {
  const definition: ToolDefinition<GetEquipmentTagDetailsInput, GetEquipmentTagDetailsData> = {
    name: "get_equipment_tag_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEquipmentTagDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/equipments/tags/${input.id}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "EQUIPMENT_TAG_NOT_FOUND",
      });

      return {
        data: { tag: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_equipment_tag_details",
      description: "Get details of a single equipment tag by id within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
