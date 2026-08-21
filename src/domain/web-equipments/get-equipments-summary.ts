/**
 * US-093 — Consultar resumo de equipamentos.
 * Endpoint: GET /v1.0/equipments/summary (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * ACHADO REAL — shape de resposta diferente do documentado no
 * openapi.json (`{items: object}`, sem detalhar o conteúdo de `items`).
 * Resposta real, confirmada em homologação nesta rodada: objeto plano
 * `{active, inactive, maintenance, discarded, total, lost}` (contagens
 * por status do ciclo de vida do equipamento) — sem a chave `items`.
 * Repassado como veio (CLAUDE.md Seção 7: a resposta real é a fonte de
 * verdade).
 *
 * `filters[model_id][eq]` confirmado funcionando: sem filtro,
 * `{active: 15808, ..., total: 18219}`; com `model_id=3`, contagens bem
 * menores e distintas (`{..., total: 50}`) — efeito real, não um no-op.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebEquipmentsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/summary";

export const getEquipmentsSummaryInputSchema = z.object({
  central: centralSchema,
  model_id: z.number().int().optional(),
});

export type GetEquipmentsSummaryInput = z.infer<typeof getEquipmentsSummaryInputSchema>;

export interface GetEquipmentsSummaryData {
  summary: Record<string, unknown>;
}

export function createGetEquipmentsSummaryTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<GetEquipmentsSummaryInput, GetEquipmentsSummaryData> {
  const definition: ToolDefinition<GetEquipmentsSummaryInput, GetEquipmentsSummaryData> = {
    name: "get_equipments_summary",
    risk: "low",
    requiresCentral: true,
    inputSchema: getEquipmentsSummaryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/equipments/summary",
        query: {
          "filters[model_id][eq]": input.model_id,
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
      name: "get_equipments_summary",
      description: "Get aggregated equipment counts by lifecycle status (active, inactive, maintenance, discarded, lost) for an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
