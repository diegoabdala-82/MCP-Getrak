/**
 * US-041 — Consultar categorias de perímetro.
 * Endpoint: GET /v1.0/perimeters/categories (v1.0, vigente,
 * oauth2Password/GetrakWeb — token delegado). Confirmado contra
 * reference/openapi.json: query params reais `page, per_page, fields[]`
 * (array real, repetido — default explode=true, mesmo padrão de
 * search-geofences.ts), default id/name/type quando omitido; `order[name]`,
 * `order[id]` (ASC/DESC); `filters[name]` (exato), `filters[name][inc]`
 * (contém), `filters[type]` (C=Geofence, P=Reference point),
 * `filters[client_id]` (integer). Paginação real = page/per_page com
 * envelope `{data, page, pages, total}`.
 *
 * Mesma nota de acesso por papel de US-040 quando pertinente ao dado
 * retornado — não implementada no MCP (domain/perimeters/shared.ts).
 *
 * NOME DA TOOL: spec sugeriu `list_perimeter_categories`; renomeada para
 * `search_perimeter_categories` — tem filtros reais (name, type, client_id).
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

const SOURCE_ENDPOINT = "GET /v1.0/perimeters/categories";

const PERIMETER_CATEGORY_FIELDS = [
  "client_id",
  "color",
  "custom_fields",
  "id",
  "name",
  "parent_id",
  "prefix",
  "suffix",
  "type",
] as const;

export const searchPerimeterCategoriesInputSchema = z.object({
  central: centralSchema,
  fields: z.array(z.enum(PERIMETER_CATEGORY_FIELDS)).optional(),
  name: z.string().optional(),
  name_contains: z.string().optional(),
  type: z.enum(["C", "P"]).optional(),
  client_id: z.number().int().optional(),
  sort_by: z.enum(["name", "id"]).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchPerimeterCategoriesInput = z.infer<typeof searchPerimeterCategoriesInputSchema>;

export interface SearchPerimeterCategoriesData {
  categories: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchPerimeterCategoriesTool(
  deps: PerimetersToolDeps,
): DomainToolRegistration<SearchPerimeterCategoriesInput, SearchPerimeterCategoriesData> {
  const definition: ToolDefinition<SearchPerimeterCategoriesInput, SearchPerimeterCategoriesData> = {
    name: "search_perimeter_categories",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchPerimeterCategoriesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/perimeters/categories",
        query: {
          "fields[]": input.fields,
          "filters[name]": input.name,
          "filters[name][inc]": input.name_contains,
          "filters[type]": input.type,
          "filters[client_id]": input.client_id,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { categories: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_perimeter_categories",
      description: "Search perimeter categories (shared between geofences and reference points) within an authorized central.",
      intent: "read",
      domain: "perimeters",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
