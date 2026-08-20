/**
 * US-052 — Consultar resumo de abastecimentos.
 * Endpoint: GET /v2.0/maintenance/fuel-supply/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Sem filtro: `{total_cost, avg_price_per_unit, cost_per_km,
 *     consumption, metadata: {available_fuel_types}}`, exatamente como
 *     documentado.
 *   - `filters[vehicle_id]` reduz o agregado corretamente para um veículo
 *     específico (confirmado com um veículo real).
 *   - **MESMA VALIDAÇÃO DE EXISTÊNCIA DE VEÍCULO já vista em
 *     `search_fuel_supplies`**: `filters[vehicle_id]` com um id
 *     inexistente retorna HTTP 404 (`{"error":"Vehicle not found"}`), não
 *     um resumo zerado. `notFoundCode: "VEHICLE_NOT_FOUND"` aplicado pela
 *     mesma razão.
 *   - `filters[fuel_type][in][]`/`filters[supply_date][gte]`/`[lte]`
 *     (documentados, mesmo formato de `search_fuel_supplies`) não
 *     testados isoladamente nesta rodada, expostos por seguirem o mesmo
 *     formato já confirmado no endpoint de lista irmão.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/fuel-supply/summary";

const FUEL_TYPES = [
  "arla",
  "compressed_natural_gas",
  "diesel",
  "diesel_s10",
  "diesel_s500",
  "electric",
  "ethanol",
  "gasoline",
  "premium_ethanol",
  "premium_gasoline",
] as const;

export const getFuelSupplySummaryInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().optional(),
  supply_date_after: z.string().optional(),
  supply_date_before: z.string().optional(),
  fuel_types: z.array(z.enum(FUEL_TYPES)).optional(),
});

export type GetFuelSupplySummaryInput = z.infer<typeof getFuelSupplySummaryInputSchema>;

export interface GetFuelSupplySummaryData {
  summary: Record<string, unknown>;
}

export function createGetFuelSupplySummaryTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetFuelSupplySummaryInput, GetFuelSupplySummaryData> {
  const definition: ToolDefinition<GetFuelSupplySummaryInput, GetFuelSupplySummaryData> = {
    name: "get_fuel_supply_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getFuelSupplySummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v2.0/maintenance/fuel-supply/summary",
        query: {
          "filters[vehicle_id]": input.vehicle_id,
          "filters[supply_date][gte]": input.supply_date_after,
          "filters[supply_date][lte]": input.supply_date_before,
          "filters[fuel_type][in][]": input.fuel_types,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      return {
        data: { summary: normalizeItem(raw) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_fuel_supply_summary",
      description: "Get aggregated fuel supply metrics (total cost, average price, consumption) for an authorized central, optionally scoped to a vehicle.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
