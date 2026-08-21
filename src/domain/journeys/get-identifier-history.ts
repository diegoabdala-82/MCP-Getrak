/**
 * US-089 — Consultar histórico de identificador.
 * Endpoint: GET /v1.0/journeys/identifier-history (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * ACHADO CRÍTICO — `filters[driver_id]` é obrigatório na prática: omiti-lo
 * não produz um HTTP 400 limpo, produz HTTP 500 `{"error":"Internal
 * error"}` genérico (mesmo padrão já visto em Operations/US-079). Por
 * isso `driver_id` é obrigatório no schema Zod desta tool — único ponto
 * real de proteção do consumidor contra esse erro cru, já que a validação
 * roda antes de qualquer chamada à API Core (`ToolRuntime`).
 *
 * `driver_id` inexistente retorna HTTP 200 com lista vazia normalizada
 * (não 404/500) — comportamento padrão, sem necessidade de `notFoundCode`.
 *
 * `start_date`/`end_date` vêm em formato `"YYYY-MM-DD HH:mm:ss"` (espaço,
 * sem `T`/`Z`) — diferente do ISO 8601 usado no resto do domínio Journeys
 * (`start_date`/`end_date` de viagens). Repassado como veio, não
 * reformatado (CLAUDE.md Seção 7).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callGetrakWebEndpoint,
  centralSchema,
  extractPagePerPageEnvelope,
  normalizeItem,
  paginationInputShape,
  type JourneysToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/journeys/identifier-history";

export const getIdentifierHistoryInputSchema = z.object({
  central: centralSchema,
  driver_id: z.number().int().positive(),
  sort_by: z.enum(["start_date", "end_date"]).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type GetIdentifierHistoryInput = z.infer<typeof getIdentifierHistoryInputSchema>;

export interface GetIdentifierHistoryData {
  history: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createGetIdentifierHistoryTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<GetIdentifierHistoryInput, GetIdentifierHistoryData> {
  const definition: ToolDefinition<GetIdentifierHistoryInput, GetIdentifierHistoryData> = {
    name: "get_identifier_history",
    risk: "low",
    requiresCentral: true,
    inputSchema: getIdentifierHistoryInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "DESC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/journeys/identifier-history",
        query: {
          "filters[driver_id]": input.driver_id,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { history: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_identifier_history",
      description: "Get the identifier assignment history for a specific driver within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
