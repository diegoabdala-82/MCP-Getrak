/**
 * US-075 — Consultar status de múltiplos veículos.
 * Endpoint: GET /v1.0/localization/vehicles-status (não depreciado,
 * oauth2Password/GetrakWeb — token delegado). "Mesma família de dados" que
 * US-074 (spec) — mesma sobreposição com US-013/Epic 3 documentada em
 * `get-vehicle-status.ts`, não repetida aqui.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Envelope `{data: [...], page, pages, total}`, mesmo formato do resto
 *     do Epic 10/16/17.
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: confirmado empiricamente
 *     (25 itens com `perPage=2`, 2 itens com `per_page=2`, mesmo `total`).
 *   - `filters[plate]` confirmado funcional; filtro sem correspondência
 *     retorna lista vazia normalizada, nunca erro.
 *   - `order[gps_time]`/`order[server_time]` documentados com enum
 *     `asc`/`desc` MINÚSCULO — diferente da convenção `ASC`/`DESC` usada em
 *     quase todos os outros `order[...]` deste projeto (Epic 9/10/16/
 *     `search_web_vehicles` incluída). Respeitado o valor real documentado
 *     aqui, não a convenção do resto do projeto — mesma disciplina de "usar
 *     o nome/valor real, não o assumido" já aplicada ao bug de paginação e
 *     ao typo `updatad_at` do Epic 16.
 *   - `filters[status]`/`filters[category_vehicle_id]` são documentados
 *     explicitamente como "repeat the parameter to match multiple" — tratados
 *     como array real (repetido), mesmo mecanismo já usado para `fields[]`/
 *     `include[]` em outras tools deste projeto. Não testados empiricamente
 *     de forma isolada nesta rodada (o texto do próprio `openapi.json` já
 *     confirma o formato de repetição, reduzindo o risco de estar assumindo
 *     algo não confirmado por nenhuma fonte).
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
  type WebVehiclesToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/localization/vehicles-status";

const COMMUNICATION_RANGES = [
  "above_72h",
  "from_1h_to_6h",
  "from_24h_to_48h",
  "from_48h_to_72h",
  "from_6h_to_24h",
  "less_than_1h",
  "never_communicated",
] as const;
const REGISTRATION_STATUSES = ["active", "restricted"] as const;
const SORTABLE_FIELDS = ["gps_time", "server_time"] as const;

export const searchVehiclesStatusInputSchema = z.object({
  central: centralSchema,
  plate: z.string().optional(),
  vin: z.string().optional(),
  nickname: z.string().optional(),
  client_id: z.number().int().positive().optional(),
  client_id_is_null: z.boolean().optional(),
  subclient_id: z.number().int().positive().optional(),
  vehicle_id: z.number().int().positive().optional(),
  search: z.string().optional(),
  communication_range: z.enum(COMMUNICATION_RANGES).optional(),
  statuses: z.array(z.enum(REGISTRATION_STATUSES)).optional(),
  device_id_contains: z.string().optional(),
  category_vehicle_ids: z.array(z.number().int().positive()).optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["asc", "desc"]).optional(),
  ...paginationInputShape,
});

export type SearchVehiclesStatusInput = z.infer<typeof searchVehiclesStatusInputSchema>;

export interface SearchVehiclesStatusData {
  statuses: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchVehiclesStatusTool(
  deps: WebVehiclesToolDeps,
): DomainToolRegistration<SearchVehiclesStatusInput, SearchVehiclesStatusData> {
  const definition: ToolDefinition<SearchVehiclesStatusInput, SearchVehiclesStatusData> = {
    name: "search_vehicles_status",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchVehiclesStatusInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "asc" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/localization/vehicles-status",
        query: {
          "filters[plate]": input.plate,
          "filters[vin]": input.vin,
          "filters[nickname]": input.nickname,
          "filters[client_id]": input.client_id,
          "filters[client_id][is_null]": input.client_id_is_null,
          "filters[subclient_id]": input.subclient_id,
          "filters[vehicle_id]": input.vehicle_id,
          "filters[search]": input.search,
          "filters[communication_range]": input.communication_range,
          "filters[status]": input.statuses,
          "filters[device_id]": input.device_id_contains,
          "filters[category_vehicle_id]": input.category_vehicle_ids,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { statuses: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_vehicles_status",
      description:
        "Search current status (location, ignition, communication range) of multiple vehicles within an authorized central. " +
        "Same data family as get_vehicle_status — overlaps with get_vehicle_current_location (Epic 3), see source comments.",
      intent: "read",
      domain: "web_vehicles",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
