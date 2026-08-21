/**
 * US-058 — Consultar resumo de manutenções.
 * Endpoint: GET /v2.0/maintenance/maintenances/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Sem filtro: `{next_maintenances: {total_value_cents, count,
 *     days_ahead}, overdue_maintenances: {total_value_cents, count},
 *     maintenance_cost: {total_value_cents, count, days_back}}`,
 *     exatamente como documentado.
 *   - `filters[vehicle_id]` com um veículo inexistente retorna um resumo
 *     TOTALMENTE ZERADO (HTTP 200), **NÃO HTTP 404** — diferente do
 *     comportamento de `get_fuel_supply_summary` para o mesmo conceito de
 *     filtro (`filters[vehicle_id]`, mesmo nome de parâmetro, mesmo
 *     domínio Maintenance). Confirma que a validação de existência de
 *     veículo é específica do sub-domínio `fuel-supply`; NENHUM
 *     `notFoundCode` de veículo é usado aqui.
 *   - `days_ahead`/`days_back` (documentados, opcionais, controlam a
 *     janela de contagem de "próximas manutenções"/"custo recente") não
 *     testados isoladamente nesta rodada; expostos por serem parâmetros
 *     numéricos simples e bem documentados (`minimum: 1, maximum: 365`).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/maintenances/summary";

export const getMaintenancesSummaryInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().optional(),
  days_ahead: z.number().int().min(1).max(365).optional(),
  days_back: z.number().int().min(1).max(365).optional(),
});

export type GetMaintenancesSummaryInput = z.infer<typeof getMaintenancesSummaryInputSchema>;

export interface GetMaintenancesSummaryData {
  summary: Record<string, unknown>;
}

export function createGetMaintenancesSummaryTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetMaintenancesSummaryInput, GetMaintenancesSummaryData> {
  const definition: ToolDefinition<GetMaintenancesSummaryInput, GetMaintenancesSummaryData> = {
    name: "get_maintenances_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getMaintenancesSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v2.0/maintenance/maintenances/summary",
        query: {
          "filters[vehicle_id]": input.vehicle_id,
          days_ahead: input.days_ahead,
          days_back: input.days_back,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
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
      name: "get_maintenances_summary",
      description: "Get aggregated maintenance metrics (upcoming, overdue, recent cost) for an authorized central, optionally scoped to a vehicle.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
