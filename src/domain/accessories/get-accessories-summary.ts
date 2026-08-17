/**
 * US-037 — Consultar resumo de acessórios.
 * Endpoint: GET /v1.0/accessories/summary (v1.0, vigente,
 * oauth2Password/GetrakWeb — token delegado). Confirmado contra
 * reference/openapi.json: sem nenhum parâmetro de request; resposta é um
 * objeto único `{skus, categories}` (contagens) — sem paginação, sem
 * envelope `{data, page, pages, total}` (diferente das outras 2 tools deste
 * domínio). Mesmo tratamento de get_vehicle_category/get_centrals: central
 * exigido só como gate de autorização/resolução de token, não repassado ao
 * endpoint (que não o aceita).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type AccessoriesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/accessories/summary";

export const getAccessoriesSummaryInputSchema = z.object({
  central: centralSchema,
});

export type GetAccessoriesSummaryInput = z.infer<typeof getAccessoriesSummaryInputSchema>;

export interface GetAccessoriesSummaryData {
  summary: Record<string, unknown>;
}

export function createGetAccessoriesSummaryTool(
  deps: AccessoriesToolDeps,
): DomainToolRegistration<GetAccessoriesSummaryInput, GetAccessoriesSummaryData> {
  const definition: ToolDefinition<GetAccessoriesSummaryInput, GetAccessoriesSummaryData> = {
    name: "get_accessories_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getAccessoriesSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/accessories/summary",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const summary = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { summary },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_accessories_summary",
      description: "Get an aggregated summary (SKU and category counts) of accessories within an authorized central.",
      intent: "read",
      domain: "accessories",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
