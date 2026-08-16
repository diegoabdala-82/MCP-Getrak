/**
 * US-040 — Consultar cercas eletrônicas (geofences).
 * Endpoint: GET /v1.0/perimeters/geofences (v1.0, vigente,
 * oauth2Password/GetrakWeb — token delegado). Confirmado contra
 * reference/openapi.json: query params reais `page, per_page, fields[]`
 * (array real, repetido — sem `style`/`explode` explícitos no doc, logo
 * default explode=true; diferente de search-central-integrations.ts, onde
 * fields[]/include[] são comma-joined; heterogeneidade real, não assumida),
 * default id/name quando omitido; `include[]` (array, valor único
 * documentado "category"); `order[name]`, `order[id]` (ASC/DESC);
 * `filters[name]` (exato), `filters[name][inc]` (contém), `filters[is_active]`
 * (Y/N). Paginação real = page/per_page com envelope `{data, page, pages, total}`.
 *
 * Acesso por papel do usuário (ADMIN/OPERADOR vs. CLIENTE/SUBCLIENTE): não
 * implementado no MCP — ver domain/perimeters/shared.ts para a decisão
 * completa (opção b).
 *
 * NOME DA TOOL: spec sugeriu `list_geofences`; renomeada para
 * `search_geofences` — tem filtros reais (name, is_active), mesma
 * convenção já aplicada em Epic 9/Accessories/Integrations.
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

const SOURCE_ENDPOINT = "GET /v1.0/perimeters/geofences";

const GEOFENCE_FIELDS = ["client_id", "id", "is_active", "name", "shape"] as const;

export const searchGeofencesInputSchema = z.object({
  central: centralSchema,
  fields: z.array(z.enum(GEOFENCE_FIELDS)).optional(),
  include_category: z.boolean().optional(),
  name: z.string().optional(),
  name_contains: z.string().optional(),
  is_active: z.enum(["Y", "N"]).optional(),
  sort_by: z.enum(["name", "id"]).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchGeofencesInput = z.infer<typeof searchGeofencesInputSchema>;

export interface SearchGeofencesData {
  geofences: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchGeofencesTool(
  deps: PerimetersToolDeps,
): DomainToolRegistration<SearchGeofencesInput, SearchGeofencesData> {
  const definition: ToolDefinition<SearchGeofencesInput, SearchGeofencesData> = {
    name: "search_geofences",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchGeofencesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/perimeters/geofences",
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
        data: { geofences: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_geofences",
      description:
        "Search registered geofences within an authorized central. " +
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
