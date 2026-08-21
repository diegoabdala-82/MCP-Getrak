/**
 * US-099 — Buscar modelos de dispositivo.
 * Endpoint: GET /v1.0/equipments/device-models (não depreciado,
 * oauth2Password/GetrakWeb — token delegado; o mesmo endpoint também
 * aceita `oauth2ClientCredentials`/`Integracao` no openapi.json, mas esta
 * tool usa exclusivamente o fluxo delegado, consistente com o resto do
 * Epic 21).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: `perPage=2` retornou o
 *     padrão de 25 itens (ignorado); `per_page=2` retornou 2 itens
 *     corretamente. Implementado com `per_page` desde o início.
 *   - `filters[description][like]` confirmado funcionando (`ACP` → 1
 *     resultado).
 *   - `filters[all_states]=true` não alterou o total nesta central (126
 *     com e sem o filtro) — não há evidência de que o filtro esteja
 *     quebrado, apenas que todos os modelos cadastrados nesta central de
 *     demonstração já estão no estado padrão (`AVAILABLE`); diferente do
 *     achado de "confirmadamente quebrado" do Epic 19 (`order[date]`), que
 *     tinha um erro de servidor observável. Implementado fielmente ao
 *     documentado, sem assumir que está quebrado.
 *   - `filters[id][in]` (array) e `filters[description]`/`filters[id]`
 *     (exatos) não foram testados individualmente nesta rodada — expostos
 *     mesmo assim por seguirem o mesmo formato de array/string já usado e
 *     confirmado em outros parâmetros `[in]` deste mesmo domínio, mas
 *     sinalizado aqui como não 100% confirmado caso a caso.
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
  type WebEquipmentsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/equipments/device-models";

export const searchDeviceModelsInputSchema = z.object({
  central: centralSchema,
  description: z.string().optional(),
  description_contains: z.string().optional(),
  manufacturer_contains: z.string().optional(),
  ids: z.array(z.string().min(1)).optional(),
  available_in_central: z.literal(true).optional(),
  all_states: z.literal(true).optional(),
  ...paginationInputShape,
});

export type SearchDeviceModelsInput = z.infer<typeof searchDeviceModelsInputSchema>;

export interface SearchDeviceModelsData {
  device_models: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchDeviceModelsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchDeviceModelsInput, SearchDeviceModelsData> {
  const definition: ToolDefinition<SearchDeviceModelsInput, SearchDeviceModelsData> = {
    name: "search_device_models",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchDeviceModelsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/equipments/device-models",
        query: {
          "filters[description]": input.description,
          "filters[description][like]": input.description_contains,
          "filters[manufacturer][like]": input.manufacturer_contains,
          "filters[id][in]": input.ids,
          "filters[available_in_central]": input.available_in_central,
          "filters[all_states]": input.all_states,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { device_models: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_device_models",
      description: "Search device models (equipment hardware catalog) within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
