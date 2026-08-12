/**
 * US-019 — Consultar histórico de um tratamento offline.
 * Endpoint: GET /v1.0/localization/offline-treatment-history/id/{offline_treatment_id}
 * (v1.0, vigente, oauth2Password/GetrakWeb). Confirmado contra
 * reference/openapi.json: `offline_treatment_id` é parâmetro de path
 * obrigatório; resposta é um array de entradas de histórico (sem paginação
 * nativa documentada). A spec de US-019 não pede paginação padrão (ao
 * contrário de US-014/015/016) — histórico de um único tratamento é
 * naturalmente limitado, então retornado por completo, sem corte.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callLocationsEndpoint, centralSchema, normalizeItem, type LocationsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/localization/offline-treatment-history/id/{offline_treatment_id}";

export const getOfflineTreatmentHistoryInputSchema = z.object({
  central: centralSchema,
  offline_treatment_id: z.string().min(1, "offline_treatment_id is required"),
});

export type GetOfflineTreatmentHistoryInput = z.infer<typeof getOfflineTreatmentHistoryInputSchema>;

export interface GetOfflineTreatmentHistoryData {
  history: Record<string, unknown>[];
}

export function createGetOfflineTreatmentHistoryTool(
  deps: LocationsToolDeps,
): DomainToolRegistration<GetOfflineTreatmentHistoryInput, GetOfflineTreatmentHistoryData> {
  const definition: ToolDefinition<GetOfflineTreatmentHistoryInput, GetOfflineTreatmentHistoryData> = {
    name: "get_offline_treatment_history",
    risk: "low",
    requiresCentral: true,
    inputSchema: getOfflineTreatmentHistoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callLocationsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: `/v1.0/localization/offline-treatment-history/id/${encodeURIComponent(input.offline_treatment_id)}`,
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const history = (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []).map(normalizeItem);

      return {
        data: { history },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_offline_treatment_history",
      description: "Get the history of a specific offline treatment.",
      intent: "read",
      domain: "locations",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
