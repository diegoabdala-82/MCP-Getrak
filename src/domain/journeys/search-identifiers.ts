/**
 * US-086 — Buscar identificadores GPS.
 * Endpoint: GET /v1.0/journeys/identifiers (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). Endpoint único, sem
 * ambiguidade de versão.
 *
 * Confirmado contra chamada real em homologação:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`.
 *   - `fields[]` "Defaults to id only" confirmado.
 *   - `id` do identificador é STRING (código do dispositivo/chip), não
 *     numérico — repassado como veio.
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

const SOURCE_ENDPOINT = "GET /v1.0/journeys/identifiers";

const SELECTABLE_FIELDS = ["category", "client_id", "has_driver", "id", "manufacturer", "model", "status"] as const;

const SORTABLE_FIELDS = ["id", "manufacturer", "model", "status"] as const;

export const searchIdentifiersInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  status: z.enum(["N", "Y"]).optional(),
  manufacturer: z.string().optional(),
  manufacturer_contains: z.string().optional(),
  model: z.string().optional(),
  model_contains: z.string().optional(),
  client_id: z.number().int().optional(),
  driver_id: z.number().int().optional(),
  has_driver: z.boolean().optional(),
  fields: z.array(z.enum(SELECTABLE_FIELDS)).optional(),
  include_driver: z.boolean().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchIdentifiersInput = z.infer<typeof searchIdentifiersInputSchema>;

export interface SearchIdentifiersData {
  identifiers: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchIdentifiersTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<SearchIdentifiersInput, SearchIdentifiersData> {
  const definition: ToolDefinition<SearchIdentifiersInput, SearchIdentifiersData> = {
    name: "search_identifiers",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchIdentifiersInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/journeys/identifiers",
        query: {
          "filters[search]": input.search,
          "filters[status]": input.status,
          "filters[manufacturer]": input.manufacturer,
          "filters[manufacturer][inc]": input.manufacturer_contains,
          "filters[model]": input.model,
          "filters[model][inc]": input.model_contains,
          "filters[client_id]": input.client_id,
          "filters[driver_id]": input.driver_id,
          "filters[has_driver]": input.has_driver,
          "fields[]": input.fields,
          "include[]": input.include_driver ? ["driver"] : undefined,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { identifiers: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_identifiers",
      description: "Search GPS/RFID identifiers used to link drivers to journeys within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
