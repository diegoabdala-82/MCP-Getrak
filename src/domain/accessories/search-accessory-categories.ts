/**
 * US-036 — Consultar categorias de acessórios.
 * Endpoint: GET /v1.0/accessories/categories (v1.0, vigente,
 * oauth2Password/GetrakWeb — token delegado). Confirmado contra
 * reference/openapi.json: query params reais `page, perPage,
 * filters[name][inc]` (busca por nome). Paginação real = page/per_page com
 * envelope `{data, page, pages, total}`.
 *
 * NOME DA TOOL: a spec sugeriu `list_accessory_categories`; renomeada para
 * `search_accessory_categories` para seguir a mesma convenção já aplicada
 * em Epic 9 (`get_` para listagens sem filtro real, `search_` quando há
 * filtro de busca por campo — aqui há `filters[name][inc]`). Sinalizado no
 * PR para confirmação, mesmo padrão de decisão do Epic 9.
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

const SOURCE_ENDPOINT = "GET /v1.0/accessories/categories";

export const searchAccessoryCategoriesInputSchema = z.object({
  central: centralSchema,
  name: z.string().optional(),
  ...paginationInputShape,
});

export type SearchAccessoryCategoriesInput = z.infer<typeof searchAccessoryCategoriesInputSchema>;

export interface SearchAccessoryCategoriesData {
  categories: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchAccessoryCategoriesTool(
  deps: AccessoriesToolDeps,
): DomainToolRegistration<SearchAccessoryCategoriesInput, SearchAccessoryCategoriesData> {
  const definition: ToolDefinition<SearchAccessoryCategoriesInput, SearchAccessoryCategoriesData> = {
    name: "search_accessory_categories",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchAccessoryCategoriesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "perPage");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/accessories/categories",
        query: {
          "filters[name][inc]": input.name,
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
      name: "search_accessory_categories",
      description: "Search accessory categories within an authorized central.",
      intent: "read",
      domain: "accessories",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
