/**
 * US-056 — Consultar resumo de serviços de manutenção.
 * Endpoint: GET /v2.0/maintenance/services/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: nenhum
 * parâmetro de request; resposta real `{total, active, inactive}`,
 * exatamente como documentado. Consistência cruzada confirmada com
 * `search_maintenance_services`: `active: 13, inactive: 0` bate
 * exatamente com `filters[status]=active`/`filters[status]=inactive`
 * daquela tool para a mesma central.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type MaintenanceToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/services/summary";

export const getMaintenanceServicesSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetMaintenanceServicesSummaryInput = z.infer<typeof getMaintenanceServicesSummaryInputSchema>;

export interface GetMaintenanceServicesSummaryData {
  summary: Record<string, unknown>;
}

export function createGetMaintenanceServicesSummaryTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<GetMaintenanceServicesSummaryInput, GetMaintenanceServicesSummaryData> {
  const definition: ToolDefinition<GetMaintenanceServicesSummaryInput, GetMaintenanceServicesSummaryData> = {
    name: "get_maintenance_services_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getMaintenanceServicesSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v2.0/maintenance/services/summary",
        query: {},
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
      name: "get_maintenance_services_summary",
      description: "Get aggregated maintenance service catalog counts (active, inactive) for an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
