/**
 * US-042 — Consultar pontos de referência.
 * Endpoint: GET /v1.0/perimeters/reference-points (v1.0, vigente,
 * oauth2Password/GetrakWeb — token delegado). Confirmado contra
 * reference/openapi.json: query params reais `page, per_page, fields[]`
 * (array real, repetido, default id/name quando omitido), `include[]`
 * (array, valor único documentado "category"), `order[name]`, `order[id]`
 * (ASC/DESC), `filters[name]` (exato), `filters[name][inc]` (contém),
 * `filters[is_active]` (Y/N). Paginação real = page/per_page com envelope
 * `{data, page, pages, total}`.
 *
 * Mesma regra de acesso por papel de US-040 — não implementada no MCP
 * (domain/perimeters/shared.ts).
 *
 * NOME DA TOOL: spec sugeriu `list_reference_points`; renomeada para
 * `search_reference_points` — tem filtros reais (name, is_active).
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
  type PerimetersToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/perimeters/reference-points";

const REFERENCE_POINT_FIELDS = [
  "city",
  "client_id",
  "complement",
  "district",
  "icon",
  "id",
  "is_active",
  "latitude",
  "longitude",
  "name",
  "number",
  "postal_code",
  "radius",
  "state",
  "street",
] as const;

export const searchReferencePointsInputSchema = z.object({
  central: centralSchema,
  fields: z.array(z.enum(REFERENCE_POINT_FIELDS)).optional(),
  include_category: z.boolean().optional(),
  name: z.string().optional(),
  name_contains: z.string().optional(),
  is_active: z.enum(["Y", "N"]).optional(),
  sort_by: z.enum(["name", "id"]).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchReferencePointsInput = z.infer<typeof searchReferencePointsInputSchema>;

export interface SearchReferencePointsData {
  reference_points: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchReferencePointsTool(
  deps: PerimetersToolDeps,
): DomainToolRegistration<SearchReferencePointsInput, SearchReferencePointsData> {
  const definition: ToolDefinition<SearchReferencePointsInput, SearchReferencePointsData> = {
    name: "search_reference_points",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchReferencePointsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/perimeters/reference-points",
        query: {
          "fields[]": input.fields,
          "include[]": input.include_category ? "category" : undefined,
          "filters[name]": input.name,
          "filters[name][inc]": input.name_contains,
          "filters[is_active]": input.is_active,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { reference_points: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_reference_points",
      description:
        "Search registered reference points within an authorized central. " +
        "Results are already scoped by the caller's role by the API Core (ADMIN/OPERADOR see all; CLIENTE/SUBCLIENTE see only their own).",
      intent: "read",
      domain: "perimeters",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
