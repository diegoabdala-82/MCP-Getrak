/**
 * US-057 — Buscar manutenções.
 * Endpoint: GET /v2.0/maintenance/maintenances (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` — implementado com
 *     `per_page` desde o início. Envelope de resposta é o padrão plano
 *     `{data, page, pages, total}` — diferente do endpoint irmão
 *     `/v2.0/maintenance/services` neste MESMO domínio (ver `search-
 *     maintenance-services.ts`), confirmando que nem dentro da mesma tag
 *     o padrão de paginação é uniforme.
 *   - **`fields[]` NÃO é exposto como parâmetro da tool** — achado real:
 *     sem `fields[]`, a resposta já vem com o registro quase completo
 *     (ao contrário do documentado "Defaults to id only", que é verdade
 *     para `fuel-supply` mas NÃO para este endpoint); com `fields[]`
 *     explicitamente restrito a um subconjunto pequeno (`id`, `name`),
 *     a resposta real ainda incluiu campos não pedidos (`central_id`,
 *     `maintenance_recurrence_id`, `status`, `type`) — ou seja, `fields[]`
 *     aqui não se comporta como um seletor exato, mais como uma lista de
 *     campos ADICIONAIS sobre um conjunto mínimo sempre presente.
 *     Comportamento real inconsistente demais para expor com confiança;
 *     a tool sempre recebe o registro completo (sem `fields[]]`), o que já
 *     cobre qualquer necessidade de campo do consumidor.
 *   - `include[]` (`last_execution`, `services`) confirmado funcionando
 *     como documentado — sem ele, os dois campos ficam totalmente
 *     ausentes da resposta (não `null`, ausentes); com ele, os dois são
 *     preenchidos. Exposto como parâmetro opcional.
 *   - `filters[status][in][]`, `filters[type]`, `filters[vehicle_id]
 *     [in][]`, `search_name`, `scheduled_within_days` confirmados
 *     funcionando individualmente com totais reais distintos.
 *   - **`filters[vehicle_id][in][]` com um id de veículo inexistente
 *     retorna lista vazia normalizada (HTTP 200), NÃO HTTP 404** —
 *     confirmado explicitamente para descartar a hipótese de que a
 *     validação de existência de veículo vista em `search_fuel_supplies`/
 *     `get_fuel_supply_summary` fosse uma regra geral do domínio
 *     Maintenance; é específica do sub-domínio `fuel-supply`, não se
 *     aplica aqui. Nenhum `notFoundCode` de veículo usado nesta tool.
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
  type MaintenanceToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/maintenances";

const STATUSES = ["finished", "overdue", "scheduled"] as const;
const INCLUDABLE = ["last_execution", "services"] as const;
const SORTABLE_FIELDS = ["name", "scheduled_date", "finished_at", "total_value_cents"] as const;

export const searchMaintenancesInputSchema = z.object({
  central: centralSchema,
  vehicle_ids: z.array(z.number().int()).optional(),
  service_ids: z.array(z.number().int()).optional(),
  statuses: z.array(z.enum(STATUSES)).optional(),
  type: z.enum(["periodic", "single"]).optional(),
  search_name: z.string().optional(),
  scheduled_within_days: z.number().int().positive().optional(),
  finished_within_days: z.number().int().positive().optional(),
  finished_after: z.string().optional(),
  finished_before: z.string().optional(),
  include: z.array(z.enum(INCLUDABLE)).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchMaintenancesInput = z.infer<typeof searchMaintenancesInputSchema>;

export interface SearchMaintenancesData {
  maintenances: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchMaintenancesTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<SearchMaintenancesInput, SearchMaintenancesData> {
  const definition: ToolDefinition<SearchMaintenancesInput, SearchMaintenancesData> = {
    name: "search_maintenances",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchMaintenancesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v2.0/maintenance/maintenances",
        query: {
          "filters[vehicle_id][in][]": input.vehicle_ids,
          "filters[service_id][in][]": input.service_ids,
          "filters[status][in][]": input.statuses,
          "filters[type]": input.type,
          search_name: input.search_name,
          scheduled_within_days: input.scheduled_within_days,
          finished_within_days: input.finished_within_days,
          "filters[finished_at][gte]": input.finished_after,
          "filters[finished_at][lte]": input.finished_before,
          "include[]": input.include,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { maintenances: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_maintenances",
      description: "Search scheduled, overdue and finished vehicle maintenances within an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
