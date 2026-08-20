/**
 * US-082 — Consultar resumo de viagens.
 * Endpoint: GET /v1.0/journeys/summary (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Sem parâmetros de filtro documentados; sem
 * ambiguidade de versão (não existe `/v2.0/journeys/summary`).
 *
 * Confirmado contra chamada real em homologação: `{data: {open, closed,
 * total}}` — sem paginação, objeto agregado único.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type JourneysToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/summary";

export const getJourneysSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetJourneysSummaryInput = z.infer<typeof getJourneysSummaryInputSchema>;

export interface GetJourneysSummaryData {
  summary: Record<string, unknown>;
}

export function createGetJourneysSummaryTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetJourneysSummaryInput, GetJourneysSummaryData> {
  const definition: ToolDefinition<GetJourneysSummaryInput, GetJourneysSummaryData> = {
    name: "get_journeys_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getJourneysSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> }>({
        deps,
        path: "/v1.0/journeys/summary",
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
      name: "get_journeys_summary",
      description: "Get an aggregate summary of journeys (open/closed/total) within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
