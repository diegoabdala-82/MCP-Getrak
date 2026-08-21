/**
 * US-055 — Buscar serviços de manutenção.
 * Endpoint: GET /v2.0/maintenance/services (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * ACHADO CRÍTICO — envelope de paginação DIFERENTE de todo o resto do
 * domínio Getrak Web (incluindo os outros 2 endpoints de lista deste
 * MESMO domínio Maintenance, `fuel-supply` e `maintenances`, que usam o
 * padrão plano `{data, page, pages, total}`). Confirmado empiricamente:
 * a resposta real é `{data: [...], pagination: {total, page,
 * itemsPerPage, totalPages}}` — objeto `pagination` ANINHADO, com chaves
 * camelCase (`itemsPerPage`, `totalPages`) diferentes até do que o
 * próprio `openapi.json` documenta para essas chaves
 * (`items_per_page`/`total_pages`, snake_case) — mais uma divergência
 * documentação-vs-realidade (CLAUDE.md Seção 7). Por isso
 * `extractPagePerPageEnvelope` (que espera o formato plano) NÃO é usado
 * aqui — implementada uma extração local (`extractServicesEnvelope`)
 * específica para este endpoint.
 *
 * O NOME DO PARÂMETRO DE QUERY, porém, continua sendo `per_page` — mesmo
 * bug de sempre (`perPage` silenciosamente ignorado; `items_per_page`
 * também testado e confirmado SEM efeito; só `per_page` funciona).
 *
 * Confirmado também:
 *   - `search_name` (substring, case-insensitive) funcionando.
 *   - `filters[status]` (`active`/`inactive`) funcionando — `inactive`
 *     retornou `total: 0` nesta central (achado real: nenhum serviço
 *     inativo cadastrado, consistente com `get_maintenance_services_
 *     summary` retornando `{active: 13, inactive: 0, total: 13}` para a
 *     mesma central — lista vazia normalizada, não erro).
 *   - `order[name]`/`order[value_cents]` confirmados funcionando
 *     corretamente (`value_cents` em ordem decrescente real observada).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPagePerPagePagination,
  callGetrakWebEndpoint,
  centralSchema,
  normalizeItem,
  paginationInputShape,
  type MaintenanceToolDeps,
} from "./shared.js";
import type { PaginationMeta } from "../../foundation/pagination/pagination.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/services";

const SORTABLE_FIELDS = ["name", "value_cents"] as const;

export const searchMaintenanceServicesInputSchema = z.object({
  central: centralSchema,
  search_name: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchMaintenanceServicesInput = z.infer<typeof searchMaintenanceServicesInputSchema>;

export interface SearchMaintenanceServicesData {
  services: Record<string, unknown>[];
  pagination: PaginationMeta;
}

/**
 * Extração local para o envelope `{data, pagination: {total, page,
 * itemsPerPage, totalPages}}` real deste endpoint — não reaproveita
 * `extractPagePerPageEnvelope` (formato plano) por serem shapes
 * genuinamente diferentes, não uma variação cosmética.
 */
function extractServicesEnvelope(
  raw: unknown,
  page: number,
  page_size: number,
): { items: Record<string, unknown>[]; meta: PaginationMeta } {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = Array.isArray(obj.data) ? (obj.data as Record<string, unknown>[]) : [];
  const pagination = obj.pagination && typeof obj.pagination === "object" ? (obj.pagination as Record<string, unknown>) : {};
  const totalPages = typeof pagination.totalPages === "number" ? pagination.totalPages : null;
  const total = typeof pagination.total === "number" ? pagination.total : null;

  return {
    items,
    meta: {
      page,
      page_size,
      total_items: total,
      has_more: totalPages !== null ? page < totalPages : items.length >= page_size,
    },
  };
}

export function createSearchMaintenanceServicesTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<SearchMaintenanceServicesInput, SearchMaintenanceServicesData> {
  const definition: ToolDefinition<SearchMaintenanceServicesInput, SearchMaintenanceServicesData> = {
    name: "search_maintenance_services",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchMaintenanceServicesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v2.0/maintenance/services",
        query: {
          search_name: input.search_name,
          "filters[status]": input.status,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractServicesEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { services: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_maintenance_services",
      description: "Search maintenance service catalog entries (e.g. oil change, alignment) within an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
