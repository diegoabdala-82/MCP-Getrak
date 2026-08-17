/**
 * US-071 — Buscar veículo pelo equipamento atual.
 * Endpoint: GET /v1.0/vehicles/equipments/{serial_number} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: resposta bate
 * com o documentado no openapi.json — `{linked_at, serial_number, vehicle:
 * {id, plate, nickname}}` — sem divergência real encontrada (raro nesta
 * rodada; sinalizado por consistência com a disciplina de verificação
 * empírica, não porque houvesse motivo para suspeitar de divergência aqui).
 *
 * 404 confirmado: `{"status":404,"error":"Vehicle not found"}` — normalizado
 * para `VEHICLE_NOT_FOUND` (AC da spec).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebVehiclesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/vehicles/equipments/{serial_number}";

export const getVehicleByEquipmentInputSchema = z.object({
  central: centralSchema,
  serial_number: z.string().min(1, "serial_number is required"),
});

export type GetVehicleByEquipmentInput = z.infer<typeof getVehicleByEquipmentInputSchema>;

export interface GetVehicleByEquipmentData {
  link: Record<string, unknown>;
}

export function createGetVehicleByEquipmentTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<GetVehicleByEquipmentInput, GetVehicleByEquipmentData> {
  const definition: ToolDefinition<GetVehicleByEquipmentInput, GetVehicleByEquipmentData> = {
    name: "get_vehicle_by_equipment",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleByEquipmentInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/vehicles/equipments/${encodeURIComponent(input.serial_number)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const link = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { link },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_by_equipment",
      description: "Find the vehicle currently linked to a given equipment serial number, within an authorized central.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
