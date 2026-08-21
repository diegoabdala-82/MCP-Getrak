/**
 * US-087 — Consultar resumo de identificadores.
 * Endpoint: GET /v1.0/journeys/identifiers/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real: `{data: {available, has_driver, total}}`
 * — sem paginação, objeto agregado único.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type JourneysToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/identifiers/summary";

export const getIdentifiersSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetIdentifiersSummaryInput = z.infer<typeof getIdentifiersSummaryInputSchema>;

export interface GetIdentifiersSummaryData {
  summary: Record<string, unknown>;
}

export function createGetIdentifiersSummaryTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetIdentifiersSummaryInput, GetIdentifiersSummaryData> {
  const definition: ToolDefinition<GetIdentifiersSummaryInput, GetIdentifiersSummaryData> = {
    name: "get_identifiers_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getIdentifiersSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> }>({
        deps,
        path: "/v1.0/journeys/identifiers/summary",
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
      name: "get_identifiers_summary",
      description: "Get an aggregate summary of GPS/RFID identifiers (available/has driver/total) within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
