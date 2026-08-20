/**
 * US-080 — Buscar viagens.
 * Endpoint primário: GET /v2.0/journeys. Fallback interno: GET /v1.0/journeys
 * (GAP-020, decisão de Engenharia "Opção A" — ver comentário de topo de
 * `shared.ts` para o racional completo). Nenhum dos dois é `deprecated` no
 * `openapi.json`.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` de todo o resto do
 *     domínio Getrak Web, reproduzido em AMBAS as versões — implementado
 *     com `per_page` desde o início.
 *   - `fields[]` confirmado "Defaults to id only" em AMBAS as versões
 *     (apesar do `openapi.json` só documentar esse default para v2.0) —
 *     exposto como parâmetro opcional, restrito ao enum documentado de
 *     v2.0 (subconjunto compatível com v1.0, que aceita os mesmos nomes).
 *   - `filters[status][in][]` exige o sufixo de array `[]`, confirmado em
 *     v1.0 (sem `[]`, filtro silenciosamente ignorado).
 *   - `include[]=driver` funciona nas duas versões, mas com SHAPE
 *     DIFERENTE do objeto `driver` retornado (v1.0 tem mais campos que
 *     v2.0) — ver achado detalhado em `shared.ts`. Não normalizado
 *     artificialmente.
 *
 * ACHADO CRÍTICO (por isso `client_id` não é parâmetro desta tool):
 * `filters[client_id]` em v2.0 é documentado como "ignorado para usuários
 * client/subclient", mas testado contra produção real (usuário não-admin)
 * e confirmado que qualquer valor não-zero retorna HTTP 500. Não exposto.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callWithV1Fallback,
  centralSchema,
  extractPagePerPageEnvelope,
  normalizeItem,
  paginationInputShape,
  type JourneysToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT_V2 = "GET /v2.0/journeys";
const SOURCE_ENDPOINT_V1 = "GET /v1.0/journeys (fallback)";

const SELECTABLE_FIELDS = [
  "authorized",
  "central",
  "client_id",
  "driver_id",
  "end_date",
  "id",
  "reprocessed",
  "start_date",
  "status",
  "time_limit",
  "vehicle_id",
] as const;

const STATUSES = ["A", "E", "F"] as const;

const SORTABLE_FIELDS = ["id", "vehicle_id", "status", "start_date", "end_date", "driver_id"] as const;

export const searchJourneysInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().optional(),
  driver_id: z.number().int().optional(),
  statuses: z.array(z.enum(STATUSES)).optional(),
  start_date_after: z.string().optional(),
  start_date_before: z.string().optional(),
  fields: z.array(z.enum(SELECTABLE_FIELDS)).optional(),
  include_driver: z.boolean().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchJourneysInput = z.infer<typeof searchJourneysInputSchema>;

export interface SearchJourneysData {
  journeys: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchJourneysTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<SearchJourneysInput, SearchJourneysData> {
  const definition: ToolDefinition<SearchJourneysInput, SearchJourneysData> = {
    name: "search_journeys",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchJourneysInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const sharedQuery = {
        "filters[vehicle_id]": input.vehicle_id,
        "filters[driver_id]": input.driver_id,
        "filters[status][in][]": input.statuses,
        "filters[start_date][gte]": input.start_date_after,
        "filters[start_date][lte]": input.start_date_before,
        "fields[]": input.fields,
        "include[]": input.include_driver ? ["driver"] : undefined,
        ...sortQuery,
        ...upstreamPagination.query,
      };

      const { raw, usedFallback } = await callWithV1Fallback<unknown>({
        deps,
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        v2: { path: "/v2.0/journeys", query: sharedQuery },
        v1: { path: "/v1.0/journeys", query: sharedQuery },
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { journeys: items.map(normalizeItem), pagination: meta },
        endpoints: [usedFallback ? SOURCE_ENDPOINT_V1 : SOURCE_ENDPOINT_V2],
        authScheme: "oauth2Password",
        warnings: usedFallback
          ? ["Served by the internal v1.0 fallback because the primary v2.0 endpoint failed (GAP-020)."]
          : [],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_journeys",
      description: "Search vehicle journeys (trips) within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
