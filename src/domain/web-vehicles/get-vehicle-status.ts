/**
 * US-074 — Consultar status de um veículo.
 * Endpoint: GET /v1.0/localization/vehicles-status/{vehicle_id} (não
 * depreciado, oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: resposta é um
 * objeto único (não paginado) e MUITO mais rico que o exemplo do
 * openapi.json — real: `{serial_number, gps_time, server_time, gps_fix,
 * direction, update_time, longitude, latitude, speed, ignition,
 * external_battery_voltage, is_block_active, outputs, satellites_count,
 * altitude, alimentation, input_physicals, event, sub_event, panic, entrys,
 * battery_tension, backup_battery_tension, can, plate, nickname, status,
 * brand, year, icon, category_description, vin, vehicle_id, origin_odometer,
 * origin_speed, origin_hourmeter, odometer, hourmeter}`.
 * 404 confirmado: `{"status":404,"error":"Vehicle Status not found Vehicle
 * was not found"}` — normalizado para `VEHICLE_NOT_FOUND`.
 *
 * SOBREPOSIÇÃO REAL COM US-013 (`get_vehicle_current_location`, Epic 3,
 * `GET /v0.1/localizacoes`, `oauth2Password` mas modelo antigo de credencial
 * técnica) — investigada conforme instruído. **Há sobreposição real de
 * dados, não só de nome**: os campos centrais de US-013 (latitude,
 * longitude, velocidade, status de ignição/entradas, data/hora do último
 * pacote — conforme CLAUDE.md Seção 0/comentário de
 * `domain/locations/get-vehicle-current-location.ts`) correspondem
 * diretamente a `latitude`/`longitude`/`speed`/`ignition`/`entrys`/
 * `gps_time`/`update_time` aqui. `get_vehicle_status` (US-074) retorna,
 * além disso, dados que US-013 não tem: odômetro/horímetro, tensão de
 * bateria (principal e de backup), status de bloqueio, contagem de
 * satélites/GPS fix, snapshot de cadastro do veículo (placa, marca, ano,
 * categoria). Não foi possível comparar o valor EXATO lado a lado no mesmo
 * veículo (US-013 usa credencial técnica antiga, não disponível neste
 * ambiente) — a sobreposição identificada é de CAMPOS/CONCEITO, confirmada
 * via a descrição já documentada de US-013 no próprio código-fonte do
 * projeto, não uma nova chamada a `/v0.1/localizacoes`. **Não consolidado
 * nem descartado** — decisão de Produto/Engenharia; sinalizado no PR.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebVehiclesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/localization/vehicles-status/{vehicle_id}";

export const getVehicleStatusInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().positive(),
});

export type GetVehicleStatusInput = z.infer<typeof getVehicleStatusInputSchema>;

export interface GetVehicleStatusData {
  status: Record<string, unknown>;
}

export function createGetVehicleStatusTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<GetVehicleStatusInput, GetVehicleStatusData> {
  const definition: ToolDefinition<GetVehicleStatusInput, GetVehicleStatusData> = {
    name: "get_vehicle_status",
    risk: "low",
    requiresCentral: true,
    inputSchema: getVehicleStatusInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/localization/vehicles-status/${encodeURIComponent(String(input.vehicle_id))}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const status = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { status },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_vehicle_status",
      description:
        "Get the current status (location, ignition, odometer/hourmeter, battery, block state) of a single vehicle " +
        "(Getrak Web view). Overlaps with get_vehicle_current_location (Epic 3) — see source comments.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
