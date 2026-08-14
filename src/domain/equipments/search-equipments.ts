/**
 * US-020 — Buscar equipamentos por módulo ou filtros.
 * Endpoint: GET /v0.2/equipamentos/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais
 * `sistema, ativo, ordem, offset, limit, modulo`; resposta é array de
 * `{chip, equipamento, id_veiculo, modulo, placa, sistema}` — `id_veiculo`
 * e `placa` só aparecem quando `ativo=Y` (equipamento vinculado a veículo).
 * `sistema` é documentado explicitamente como "Filter by central" — enviado
 * desde o início (ver domain/equipments/shared.ts e o achado tardio
 * equivalente no Epic 2, domain/vehicles/shared.ts).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPaginationMeta,
  buildUpstreamPagination,
  callEquipmentsEndpoint,
  centralSchema,
  extractArray,
  normalizeItem,
  paginationInputShape,
  type EquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/equipamentos/integracao";

export const searchEquipmentsInputSchema = z.object({
  central: centralSchema,
  module: z.string().optional(),
  /** Y = equipamento vinculado a um veículo; N = equipamento disponível (não vinculado). */
  linked: z.enum(["Y", "N"]).optional(),
  sort: z.string().optional(),
  ...paginationInputShape,
});

export type SearchEquipmentsInput = z.infer<typeof searchEquipmentsInputSchema>;

export interface SearchEquipmentsData {
  equipments: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createSearchEquipmentsTool(
  deps: EquipmentsToolDeps,
): DomainToolRegistration<SearchEquipmentsInput, SearchEquipmentsData> {
  const definition: ToolDefinition<SearchEquipmentsInput, SearchEquipmentsData> = {
    name: "search_equipments",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEquipmentsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limit");

      const raw = await callEquipmentsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/equipamentos/integracao",
        query: {
          sistema: input.central,
          modulo: input.module,
          ativo: input.linked,
          ordem: input.sort,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const equipments = extractArray(raw).map(normalizeItem);

      return {
        data: {
          equipments,
          pagination: buildPaginationMeta(equipments, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_equipments",
      description: "Search equipments by module/serial or supported filters within an authorized central.",
      intent: "read",
      domain: "equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
