/**
 * US-062 — Consultar resumo de clientes.
 * Endpoint: GET /v1.0/clients/summary (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada: nenhum
 * parâmetro de request; resposta real `{active, inactive, suspended,
 * total}`, exatamente como documentado. Consistência cruzada confirmada
 * com `search_web_clients`: `active: 1868` bate exatamente com
 * `filters[status]=Y` (1868), `suspended: 88` bate com `filters[status]=S`
 * (88).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebClientsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/clients/summary";

export const getClientsSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetClientsSummaryInput = z.infer<typeof getClientsSummaryInputSchema>;

export interface GetClientsSummaryData {
  summary: Record<string, unknown>;
}

export function createGetClientsSummaryTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<GetClientsSummaryInput, GetClientsSummaryData> {
  const definition: ToolDefinition<GetClientsSummaryInput, GetClientsSummaryData> = {
    name: "get_clients_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getClientsSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/clients/summary",
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
      name: "get_clients_summary",
      description: "Get aggregated client counts by status (active, inactive, suspended) for an authorized central.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
