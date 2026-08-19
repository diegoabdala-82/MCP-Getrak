/**
 * US-097 — Buscar tags de equipamento.
 * Endpoint: GET /v1.0/equipments/tags (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * ACHADO — mesmo problema de paginação de `search_equipment_devices`
 * (US-092): confirmado empiricamente que `page`, `per_page`, `perPage`,
 * `limit` e `offset` não têm nenhum efeito — o endpoint sempre retorna a
 * lista completa (`{data: [...]}`, sem `page`/`pages`/`total` na
 * resposta). Nesta central de demonstração o dataset é pequeno (10 tags),
 * então o risco prático é bem menor que em `search_equipment_devices`
 * (~18.200 itens) — mas o mesmo tratamento é aplicado por consistência e
 * proteção contra crescimento futuro: `createClientSideSliceAdapter`
 * (mesmo padrão de `get_centrals`/`search_equipment_devices`).
 *
 * O `openapi.json` não documenta NENHUM filtro de busca para este
 * endpoint (só `fields[]`, não exposto por já ter se mostrado arriscado
 * em outros endpoints do projeto) — esta tool não tem parâmetro de
 * filtro/busca, só paginação.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  callGetrakWebEndpoint,
  centralSchema,
  createClientSideSliceAdapter,
  normalizeItem,
  normalizePagination,
  paginationInputShape,
  type WebEquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/tags";

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw.data) ? (raw.data as Record<string, unknown>[]) : []),
});

export const searchEquipmentTagsInputSchema = z.object({
  central: centralSchema,
  ...paginationInputShape,
});

export type SearchEquipmentTagsInput = z.infer<typeof searchEquipmentTagsInputSchema>;

export interface SearchEquipmentTagsData {
  tags: Record<string, unknown>[];
  pagination: ReturnType<typeof sliceAdapter.fromUpstreamResponse>["meta"];
}

export function createSearchEquipmentTagsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchEquipmentTagsInput, SearchEquipmentTagsData> {
  const definition: ToolDefinition<SearchEquipmentTagsInput, SearchEquipmentTagsData> = {
    name: "search_equipment_tags",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEquipmentTagsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/equipments/tags",
        query: {},
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw, pagination);

      return {
        data: { tags: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
        warnings: [
          "This upstream endpoint does not support server-side pagination (confirmed) — every call fetches " +
            "the entire tag list for the central internally before slicing it to the requested page.",
        ],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_equipment_tags",
      description: "List equipment tags (custom labels used to categorize equipments) within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
