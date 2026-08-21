/**
 * US-085 — Consultar resumo de motoristas.
 * Endpoint: GET /v1.0/journeys/drivers/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Sem ambiguidade de versão
 * (não existe `/v2.0/journeys/drivers/summary`) — e, diferente da LISTA
 * v1.0 (ver `search-drivers.ts`), este endpoint específico funciona
 * normalmente.
 *
 * Confirmado contra chamada real: `{data: {has_vehicles, available,
 * total}}` — sem paginação, objeto agregado único.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type JourneysToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/drivers/summary";

export const getDriversSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetDriversSummaryInput = z.infer<typeof getDriversSummaryInputSchema>;

export interface GetDriversSummaryData {
  summary: Record<string, unknown>;
}

export function createGetDriversSummaryTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetDriversSummaryInput, GetDriversSummaryData> {
  const definition: ToolDefinition<GetDriversSummaryInput, GetDriversSummaryData> = {
    name: "get_drivers_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getDriversSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> }>({
        deps,
        path: "/v1.0/journeys/drivers/summary",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      return {
        data: { summary: normalizeItem(raw.data ?? {}) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_drivers_summary",
      description: "Get an aggregate summary of journey drivers (available/has vehicles/total) within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
