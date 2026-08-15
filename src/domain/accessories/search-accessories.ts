/**
 * US-035 — Buscar acessórios cadastrados.
 * Endpoint: GET /v1.0/accessories (v1.0, vigente, oauth2Password/GetrakWeb
 * — token delegado). Confirmado contra reference/openapi.json: query params
 * reais `page, perPage, fields[] (string única, ex.: "quantity,id,created_at"
 * — diferente de outros endpoints do mesmo Epic 10 em que fields[] é um
 * array real repetido, ver search-geofences.ts), order[category|name|sku|
 * quantity|unit|status|min|max] (cada um ASC/DESC), filters[search][inc]`
 * (busca em serial_number/device_number, conforme descrição do parâmetro).
 * Paginação real = page/per_page com envelope `{data, page, pages, total}`.
 *
 * Não aceita `sistema`/central como parâmetro (ver domain/getrak-web-shared.ts).
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
  type AccessoriesToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/accessories";

const SORTABLE_FIELDS = ["category", "name", "sku", "quantity", "unit", "status", "min", "max"] as const;

export const searchAccessoriesInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  fields: z.string().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchAccessoriesInput = z.infer<typeof searchAccessoriesInputSchema>;

export interface SearchAccessoriesData {
  accessories: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchAccessoriesTool(
  deps: AccessoriesToolDeps,
): DomainToolRegistration<SearchAccessoriesInput, SearchAccessoriesData> {
  const definition: ToolDefinition<SearchAccessoriesInput, SearchAccessoriesData> = {
    name: "search_accessories",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchAccessoriesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "perPage");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/accessories",
        query: {
          "fields[]": input.fields,
          "filters[search][inc]": input.search,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { accessories: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_accessories",
      description: "Search registered accessories within an authorized central.",
      intent: "read",
      domain: "accessories",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
