/**
 * US-083 — Buscar motoristas.
 * Endpoint primário: GET /v2.0/journeys/drivers. Fallback interno:
 * GET /v1.0/journeys/drivers (GAP-020, decisão de Engenharia "Opção A").
 *
 * ACHADO CRÍTICO — o endpoint de fallback está QUEBRADO: `GET
 * /v1.0/journeys/drivers` retorna HTTP 500 para QUALQUER chamada testada,
 * inclusive sem nenhum parâmetro (não é um filtro específico — é o
 * endpoint inteiro). Ver `shared.ts` para o racional completo. O fallback
 * foi implementado mesmo assim, exatamente como pedido pela spec — só não
 * há nenhum ganho de resiliência real até a Getrak corrigir esse endpoint;
 * se v2.0 falhar de verdade, o consumidor recebe o erro normalizado da
 * falha do v1.0 (nunca um crash), não uma recuperação bem-sucedida.
 *
 * Confirmado contra chamada real em homologação (v2.0):
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`.
 *   - `fields[]` "Defaults to id, name, status, device, registration,
 *     client_id" confirmado.
 *   - `filters[id][in][]` (e a variante sem `[]`) confirmado SILENCIOSAMENTE
 *     IGNORADO — retorna o total não filtrado. Não exposto.
 *   - `filters[has_identifier]`, `filters[has_vehicles]`, `filters[search]`,
 *     `filters[status]`, `filters[vehicle_id]` confirmados funcionando.
 *   - `order[name]` confirmado funcionando nas duas direções (comparação
 *     lexicográfica simples, não é bug — só parecia estranho no primeiro
 *     teste com nomes começando por caracteres não alfabéticos).
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

const SOURCE_ENDPOINT_V2 = "GET /v2.0/journeys/drivers";
const SOURCE_ENDPOINT_V1 = "GET /v1.0/journeys/drivers (fallback)";

const SELECTABLE_FIELDS = [
  "address",
  "address_city",
  "address_complement",
  "address_district",
  "address_number",
  "address_state",
  "address_zip",
  "birth_date",
  "blood_type",
  "client_id",
  "device",
  "document",
  "driver_license",
  "driver_license_category",
  "driver_license_expiration",
  "email",
  "father_name",
  "has_vehicles",
  "id",
  "identity",
  "last",
  "last_gps",
  "mother_name",
  "name",
  "phone1",
  "phone2",
  "phone_business",
  "phone_personal",
  "pis_pasep",
  "registration",
  "status",
] as const;

const SORTABLE_FIELDS = ["id", "name", "status", "device", "registration"] as const;

export const searchDriversInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  status: z.enum(["N", "Y"]).optional(),
  client_id: z.number().int().optional(),
  vehicle_id: z.number().int().optional(),
  has_identifier: z.boolean().optional(),
  has_vehicles: z.boolean().optional(),
  fields: z.array(z.enum(SELECTABLE_FIELDS)).optional(),
  include_client: z.boolean().optional(),
  include_identifier: z.boolean().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchDriversInput = z.infer<typeof searchDriversInputSchema>;

export interface SearchDriversData {
  drivers: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchDriversTool(
  deps: JourneysToolDeps,
): DomainToolRegistration<SearchDriversInput, SearchDriversData> {
  const definition: ToolDefinition<SearchDriversInput, SearchDriversData> = {
    name: "search_drivers",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchDriversInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};
      const include: string[] = [];
      if (input.include_client) include.push("client");
      if (input.include_identifier) include.push("identifier");

      const includeArray: undefined | typeof include = include.length > 0 ? include : undefined;
      const v2Query = {
        "filters[search]": input.search,
        "filters[status]": input.status,
        "filters[client_id]": input.client_id,
        "filters[vehicle_id]": input.vehicle_id,
        "filters[has_identifier]": input.has_identifier,
        "filters[has_vehicles]": input.has_vehicles,
        "fields[]": input.fields,
        "include[]": includeArray,
        ...sortQuery,
        ...upstreamPagination.query,
      };

      // v1.0 (fallback) só documenta `filters[name]`/`company_id` — sem
      // equivalente para status/client_id/vehicle_id/has_identifier/etc.
      // Best-effort: repassa a busca textual e a paginação, únicos
      // conceitos com equivalente real em v1.0 (que está quebrado de
      // qualquer forma — ver cabeçalho deste arquivo).
      const v1Query = {
        "filters[name]": input.search,
        ...upstreamPagination.query,
      };

      const { raw, usedFallback } = await callWithV1Fallback<unknown>({
        deps,
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        v2: { path: "/v2.0/journeys/drivers", query: v2Query },
        v1: { path: "/v1.0/journeys/drivers", query: v1Query },
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { drivers: items.map(normalizeItem), pagination: meta },
        endpoints: [usedFallback ? SOURCE_ENDPOINT_V1 : SOURCE_ENDPOINT_V2],
        authScheme: "oauth2Password",
        warnings: usedFallback
          ? [
              "Served by the internal v1.0 fallback because the primary v2.0 endpoint failed (GAP-020). " +
                "Note: v1.0 filters are a reduced best-effort mapping (only free-text search and pagination) " +
                "since v1.0 does not document the richer v2.0 filter set.",
            ]
          : [],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_drivers",
      description: "Search journey drivers registered within an authorized central.",
      intent: "read",
      domain: "journeys",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
