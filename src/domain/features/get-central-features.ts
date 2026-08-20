/**
 * US-103 — Consultar features vinculadas à central.
 * Endpoint: GET /v1.0/centrals/features (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Sem parâmetros de query.
 *
 * ACHADO CRÍTICO — a resposta real NÃO tem envelope `{data: ...}`: a
 * própria raiz do JSON já é o objeto de features (ex.:
 * `{"show_driver_mobile": true, "show_speed_mobile": true, ...}`).
 * Confirmado contra chamada real; o `openapi.json` não documenta nenhum
 * schema de resposta para este endpoint. Os 9 identificadores observados
 * na central de teste têm todos sufixo `_mobile` (capacidades de exibição
 * do app mobile) — conjunto totalmente distinto do de US-104 (ver
 * `shared.ts`). Um dos valores (`restricted_vehicle_notification_mobile`)
 * é um objeto `{title, description}`, não um booleano — repassado como
 * veio, sem assumir um shape de valor único para todas as features.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type FeaturesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/centrals/features";

export const getCentralFeaturesInputSchema = z.object({
  central: centralSchema,
});

export type GetCentralFeaturesInput = z.infer<typeof getCentralFeaturesInputSchema>;

export interface GetCentralFeaturesData {
  features: Record<string, unknown>;
}

export function createGetCentralFeaturesTool(
  deps: FeaturesToolDeps,
): DomainToolRegistration<GetCentralFeaturesInput, GetCentralFeaturesData> {
  const definition: ToolDefinition<GetCentralFeaturesInput, GetCentralFeaturesData> = {
    name: "get_central_features",
    risk: "low",
    requiresCentral: true,
    inputSchema: getCentralFeaturesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/centrals/features",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      return {
        data: { features: normalizeItem(raw ?? {}) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_central_features",
      description: "Get the features linked to (enabled/contracted for) an authorized central.",
      intent: "read",
      domain: "features",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
