/**
 * US-051 — Buscar abastecimentos.
 * Endpoint: GET /v2.0/maintenance/fuel-supply (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` de todo o resto do
 *     domínio Getrak Web — implementado com `per_page` desde o início.
 *   - `fields[]` confirmado funcionando como seletor EXATO (documentado
 *     "Defaults to id only" — confirmado empiricamente: sem `fields[]`, a
 *     resposta real de cada item é literalmente só `{id}`). Exposto como
 *     parâmetro opcional, restrito ao enum documentado.
 *   - `filters[fuel_type][in][]` — **exige o sufixo de array `[]`**, já
 *     documentado dessa forma no próprio nome do parâmetro no
 *     `openapi.json` (diferente de outros epics, aqui a documentação
 *     acertou o formato); confirmado empiricamente: com `[]`, `total=131`
 *     para `gasoline`; sem `[]` (`filters[fuel_type][in]=gasoline`), o
 *     filtro é silenciosamente ignorado (retorna o total não filtrado,
 *     275).
 *   - `filters[supply_date][gte]`/`[lte]` confirmado funcionando (total
 *     real distinto do total geral).
 *
 * ACHADO CRÍTICO — `filters[vehicle_id]` VALIDA A EXISTÊNCIA DO VEÍCULO:
 * diferente de todo outro filtro deste domínio (que retornam lista vazia
 * normalizada quando não há correspondência), filtrar por um
 * `vehicle_id` que não existe retorna **HTTP 404**
 * (`{"error":"Vehicle not found"}`), não uma lista vazia. Confirmado
 * também em `get_fuel_supply_summary` (mesmo filtro, mesmo
 * comportamento) — mas **NÃO** confirmado em `search_maintenances`/
 * `get_maintenances_summary` (mesmo conceito de filtro por veículo,
 * comportamento oposto: bogus `vehicle_id` aí retorna resultado
 * zerado/vazio normalmente, HTTP 200) — ou seja, esse comportamento de
 * validação é específico do sub-domínio `fuel-supply`, não uma regra
 * geral do domínio `Maintenance`. Por isso `notFoundCode:
 * "VEHICLE_NOT_FOUND"` é passado aqui mesmo sendo uma tool de LISTA (uso
 * não convencional de `notFoundCode`, normalmente reservado a lookups por
 * id) — decisão deliberada para não deixar esse 404 real cair em
 * `UPSTREAM_ERROR` genérico.
 *
 * Filtro sem correspondência (exceto `vehicle_id` bogus, ver acima)
 * retorna lista vazia normalizada, nunca erro.
 *
 * `amount`/`volume`/`price_per_unit` vêm como STRING na resposta real
 * (ex.: `"408.00"`, `"12.000"`), apesar de documentados como `number` —
 * repassados como vieram, não convertidos (CLAUDE.md Seção 7).
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

const SOURCE_ENDPOINT = "GET /v2.0/maintenance/fuel-supply";

const SELECTABLE_FIELDS = [
  "amount",
  "calc_method",
  "central_id",
  "created_at",
  "fuel_type",
  "gas_station",
  "gas_station_address",
  "horimeter",
  "id",
  "is_full",
  "odometer",
  "price_per_unit",
  "supply_date",
  "updated_at",
  "vehicle_id",
  "volume",
] as const;

const FUEL_TYPES = [
  "arla",
  "compressed_natural_gas",
  "diesel",
  "diesel_s10",
  "diesel_s500",
  "electric",
  "ethanol",
  "gasoline",
  "premium_ethanol",
  "premium_gasoline",
] as const;

const SORTABLE_FIELDS = ["supply_date", "vehicle_id"] as const;

export const searchFuelSuppliesInputSchema = z.object({
  central: centralSchema,
  vehicle_id: z.number().int().optional(),
  supply_date_after: z.string().optional(),
  supply_date_before: z.string().optional(),
  fuel_types: z.array(z.enum(FUEL_TYPES)).optional(),
  fields: z.array(z.enum(SELECTABLE_FIELDS)).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchFuelSuppliesInput = z.infer<typeof searchFuelSuppliesInputSchema>;

export interface SearchFuelSuppliesData {
  fuel_supplies: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchFuelSuppliesTool(
  deps: MaintenanceToolDeps,
): DomainToolRegistration<SearchFuelSuppliesInput, SearchFuelSuppliesData> {
  const definition: ToolDefinition<SearchFuelSuppliesInput, SearchFuelSuppliesData> = {
    name: "search_fuel_supplies",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchFuelSuppliesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v2.0/maintenance/fuel-supply",
        query: {
          "filters[vehicle_id]": input.vehicle_id,
          "filters[supply_date][gte]": input.supply_date_after,
          "filters[supply_date][lte]": input.supply_date_before,
          "filters[fuel_type][in][]": input.fuel_types,
          "fields[]": input.fields,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "VEHICLE_NOT_FOUND",
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { fuel_supplies: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_fuel_supplies",
      description: "Search vehicle fuel supply records within an authorized central.",
      intent: "read",
      domain: "maintenance",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
