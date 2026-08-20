/**
 * US-081 — Consultar detalhe de viagem.
 * Endpoint: GET /v1.0/journeys/{id} (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Endpoint único, sem ambiguidade de versão
 * (não existe `/v2.0/journeys/{id}` no openapi.json) — sem fallback.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - id inexistente retorna HTTP 404 real (`{"status":404,"error":"journey
 *     not found"}`) — comportamento padrão, mapeado para JOURNEY_NOT_FOUND.
 *   - `include[]=driver` funciona, shape `{id, name, email, document,
 *     system, device}`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type JourneysToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/{id}";

export const getJourneyDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
  include_driver: z.boolean().optional(),
});

export type GetJourneyDetailsInput = z.infer<typeof getJourneyDetailsInputSchema>;

export interface GetJourneyDetailsData {
  journey: Record<string, unknown>;
}

export function createGetJourneyDetailsTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetJourneyDetailsInput, GetJourneyDetailsData> {
  const definition: ToolDefinition<GetJourneyDetailsInput, GetJourneyDetailsData> = {
    name: "get_journey_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getJourneyDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> }>({
        deps,
        path: `/v1.0/journeys/${input.id}`,
        query: {
          "include[]": input.include_driver ? ["driver"] : undefined,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "JOURNEY_NOT_FOUND",
      });

      return {
        data: { journey: normalizeItem(raw.data ?? {}) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_journey_details",
      description: "Get details of a single journey (trip) by id within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
