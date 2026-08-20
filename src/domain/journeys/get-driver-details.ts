/**
 * US-084 — Consultar detalhe de motorista.
 * Endpoint: GET /v2.0/journeys/drivers/{id} (não depreciado, oauth2Password/
 * GetrakWeb — token delegado). Fora do escopo de fallback do GAP-020 (só
 * `search_journeys`/`search_drivers` precisam disso, por decisão explícita
 * da spec) — usa v2.0 diretamente.
 *
 * ACHADO CRÍTICO — id inexistente retorna HTTP 204 (SEM CORPO), não 404.
 * `response.ok` é `true` para 204, então sem tratamento especial
 * `response.json()` lançaria um erro de parse de corpo vazio, virando
 * INTERNAL_ERROR genérico. Corrigido na fundação (`ApiCoreClient.get`,
 * ver comentário lá — trata 204 como ausência de corpo de forma genérica,
 * não um hack desta tool) — aqui só verificamos `raw === undefined` e
 * lançamos `DRIVER_NOT_FOUND` explicitamente.
 *
 * `include[]=vehicle` (não documentado no include[] de US-083/search, só
 * aqui) confirmado funcionando, junto com `client`/`identifier`.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { McpToolError } from "../errors.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type JourneysToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/journeys/drivers/{id}";

const INCLUDABLE = ["client", "identifier", "vehicle"] as const;

export const getDriverDetailsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive(),
  include: z.array(z.enum(INCLUDABLE)).optional(),
});

export type GetDriverDetailsInput = z.infer<typeof getDriverDetailsInputSchema>;

export interface GetDriverDetailsData {
  driver: Record<string, unknown>;
}

export function createGetDriverDetailsTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetDriverDetailsInput, GetDriverDetailsData> {
  const definition: ToolDefinition<GetDriverDetailsInput, GetDriverDetailsData> = {
    name: "get_driver_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getDriverDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<{ data: Record<string, unknown> } | undefined>({
        deps,
        path: `/v2.0/journeys/drivers/${input.id}`,
        query: {
          "include[]": input.include,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      if (raw === undefined) {
        throw new McpToolError({ code: "DRIVER_NOT_FOUND", message: "Driver not found.", retryable: false });
      }

      return {
        data: { driver: normalizeItem(raw.data ?? {}) },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_driver_details",
      description: "Get details of a single journey driver by id within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
