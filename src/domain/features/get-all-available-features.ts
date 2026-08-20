/**
 * US-105 — Consultar todas as features disponíveis (catálogo geral,
 * independente de central).
 * Endpoint: GET /v1.0/centrals/all-features (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Sem parâmetros de query,
 * confirmado que não filtra por central (ver `shared.ts`).
 *
 * `central` continua obrigatório como parâmetro da TOOL (não do
 * endpoint) — gate de autorização do MCP e chave do token delegado
 * (CLAUDE.md Seção 3/6), mesmo padrão de `get_current_user`/US-069.
 *
 * ACHADO: os 9 `identifier` retornados aqui coincidem EXATAMENTE com as 9
 * chaves de `get_central_features`/US-103 (mesma central de teste) —
 * este catálogo documenta os metadados de US-103, não de US-104
 * (`feature-flags`), cujas 6 chaves não aparecem aqui. `value_type`
 * confirma os tipos reais observados em US-103 (`boolean`/`json`).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type FeaturesToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/centrals/all-features";

export const getAllAvailableFeaturesInputSchema = z.object({
  central: centralSchema,
});

export type GetAllAvailableFeaturesInput = z.infer<typeof getAllAvailableFeaturesInputSchema>;

export interface GetAllAvailableFeaturesData {
  features: Record<string, unknown>[];
}

export function createGetAllAvailableFeaturesTool(
  deps: FeaturesToolDeps,
): DomainToolRegistration<GetAllAvailableFeaturesInput, GetAllAvailableFeaturesData> {
  const definition: ToolDefinition<GetAllAvailableFeaturesInput, GetAllAvailableFeaturesData> = {
    name: "get_all_available_features",
    risk: "low",
    requiresCentral: true,
    inputSchema: getAllAvailableFeaturesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown>[] }>({
        deps,
        path: "/v1.0/centrals/all-features",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const items = Array.isArray(raw.data) ? raw.data : [];

      return {
        data: { features: items.map(normalizeItem) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
        warnings: [
          "This catalog is not scoped by central (confirmed: the upstream endpoint accepts no central filter) — " +
            "'central' is required here only as the MCP's authorization gate and delegated-token cache key, not as a business filter.",
        ],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_all_available_features",
      description: "Get the platform-wide catalog of all possible central features (metadata, not per-central state).",
      intent: "read",
      domain: "features",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
