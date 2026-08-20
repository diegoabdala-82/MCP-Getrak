/**
 * US-053 — Consultar detalhe de abastecimento.
 * Endpoint: GET /v2.0/maintenance/fuel-supply/{id} (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Id existente: HTTP 200, objeto completo (`id, central_id,
 *     vehicle_id, gas_station, gas_station_address, supply_date,
 *     odometer, horimeter, fuel_type, amount, is_full, volume,
 *     price_per_unit, calc_method, created_at, updated_at, deleted_at`)
 *     — inclui `deleted_at` (marcador de soft-delete), não documentado no
 *     schema de resposta, repassado como veio.
 *   - Id inexistente: HTTP 404 limpo, `{"error":"Fuel supply not
 *     found"}` — mapeado para `FUEL_SUPPLY_NOT_FOUND` via `notFoundCode`.
 *   - `amount`/`volume`/`price_per_unit` vêm como STRING (ex.: `"408.00"`,
 *     `"12.000"`, `"34.000"`), apesar de documentados como `number` —
 *     repassados como vieram (CLAUDE.md Seção 7).
 *
 * Anexos (US-054) NÃO são incluídos aqui — ver decisão registrada em
 * `get-fuel-supply-attachments.ts` (mantido como tool separada).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/fuel-supply/{id}";

export const getFuelSupplyDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
});

export type GetFuelSupplyDetailsInput = z.infer<typeof getFuelSupplyDetailsInputSchema>;

export interface GetFuelSupplyDetailsData {
  fuel_supply: Record<string, unknown>;
}

export function createGetFuelSupplyDetailsTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetFuelSupplyDetailsInput, GetFuelSupplyDetailsData> {
  const definition: ToolDefinition<GetFuelSupplyDetailsInput, GetFuelSupplyDetailsData> = {
    name: "get_fuel_supply_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getFuelSupplyDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v2.0/maintenance/fuel-supply/${input.id}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "FUEL_SUPPLY_NOT_FOUND",
      });

      return {
        data: { fuel_supply: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_fuel_supply_details",
      description: "Get details of a single fuel supply record by id within an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
