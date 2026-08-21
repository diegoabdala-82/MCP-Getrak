/**
 * US-091 — Consultar detalhe de equipamento (Getrak Web).
 * Endpoint: GET /v1.0/equipments/{serial_number} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Serial existente: HTTP 200, objeto único (`serial_number`, `central`,
 *     `model_id`, `model: {...}`, `status`, `device_number`, `device`,
 *     `chip_serial_number`, `apn`, `carrier_name`, `description`,
 *     `tag_id`, `responsible_id`, `created_at`, `updated_at`).
 *   - Serial inexistente: HTTP 404 limpo, `{"error":"Equipment not
 *     found"}` — mapeado para `EQUIPMENT_NOT_FOUND` via `notFoundCode`,
 *     nunca repassando o corpo bruto da API Core.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebEquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/{serial_number}";

export const getWebEquipmentDetailsInputSchema = z.object({
  central: centralSchema,
  serial_number: z.string().min(1, "serial_number is required"),
});

export type GetWebEquipmentDetailsInput = z.infer<typeof getWebEquipmentDetailsInputSchema>;

export interface GetWebEquipmentDetailsData {
  equipment: Record<string, unknown>;
}

export function createGetWebEquipmentDetailsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetWebEquipmentDetailsInput, GetWebEquipmentDetailsData> {
  const definition: ToolDefinition<GetWebEquipmentDetailsInput, GetWebEquipmentDetailsData> = {
    name: "get_web_equipment_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getWebEquipmentDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/equipments/${encodeURIComponent(input.serial_number)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "EQUIPMENT_NOT_FOUND",
      });

      return {
        data: { equipment: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_web_equipment_details",
      description: "Get details of a single equipment by serial number within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
