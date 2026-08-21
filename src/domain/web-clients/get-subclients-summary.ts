/**
 * US-063 — Consultar resumo de subclientes.
 * Endpoint: GET /v1.0/clients/subclients/summary (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: nenhum
 * parâmetro de request; resposta real `{active, inactive, suspended,
 * total}`, mesmo shape de `get_clients_summary` (US-062), mas para
 * subclientes — dataset distinto e real (`total: 2144`, diferente do
 * total de clientes, `2102`).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebClientsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/clients/subclients/summary";

export const getSubclientsSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetSubclientsSummaryInput = z.infer<typeof getSubclientsSummaryInputSchema>;

export interface GetSubclientsSummaryData {
  summary: Record<string, unknown>;
}

export function createGetSubclientsSummaryTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<GetSubclientsSummaryInput, GetSubclientsSummaryData> {
  const definition: ToolDefinition<GetSubclientsSummaryInput, GetSubclientsSummaryData> = {
    name: "get_subclients_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getSubclientsSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/clients/subclients/summary",
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
      name: "get_subclients_summary",
      description: "Get aggregated subclient counts by status (active, inactive, suspended) for an authorized central.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
