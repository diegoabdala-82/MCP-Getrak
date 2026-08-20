/**
 * US-104 — Consultar feature flags da central.
 * Endpoint: GET /v1.0/centrals/feature-flags (não depreciado,
 * oauth2Password/GetrakWeb — token delegado; documentado como "stored in
 * Redis"). Sem parâmetros de query.
 *
 * Confirmado contra chamada real: `{data: {...}}`, todos os valores
 * booleanos, 6 chaves na central de teste (`ai_monitoring`,
 * `video_monitoring`, `hide_getrak_store`, `hide_home_carrousel`,
 * `equipment`, `banner_countdown_v2`) — CONJUNTO TOTALMENTE DISTINTO das 9
 * chaves de US-103 (nenhuma sobreposição), confirmando que se trata de um
 * conceito genuinamente diferente (flags de rollout/produto, não
 * capacidades de exibição mobile) — ver `shared.ts` para o racional
 * completo. Nenhuma tool consolidada.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type FeaturesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/centrals/feature-flags";

export const getCentralFeatureFlagsInputSchema = z.object({
  central: centralSchema,
});

export type GetCentralFeatureFlagsInput = z.infer<typeof getCentralFeatureFlagsInputSchema>;

export interface GetCentralFeatureFlagsData {
  feature_flags: Record<string, unknown>;
}

export function createGetCentralFeatureFlagsTool(
  deps: FeaturesToolDeps,
): DomainToolRegistration<GetCentralFeatureFlagsInput, GetCentralFeatureFlagsData> {
  const definition: ToolDefinition<GetCentralFeatureFlagsInput, GetCentralFeatureFlagsData> = {
    name: "get_central_feature_flags",
    risk: "low",
    requiresCentral: true,
    inputSchema: getCentralFeatureFlagsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> }>({
        deps,
        path: "/v1.0/centrals/feature-flags",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      return {
        data: { feature_flags: normalizeItem(raw.data ?? {}) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_central_feature_flags",
      description: "Get the rollout/experiment feature flags for an authorized central (distinct from contracted features).",
      intent: "read",
      domain: "features",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
