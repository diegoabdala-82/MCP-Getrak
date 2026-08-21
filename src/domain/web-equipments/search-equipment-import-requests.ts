/**
 * US-100 — Buscar requisições de importação de equipamento.
 * Endpoint: GET /v1.0/equipments/files (não depreciado, oauth2Password/
 * GetrakWeb — token delegado).
 *
 * UTILIDADE REAL — avaliada conforme pedido pela tarefa (a spec já
 * sinalizava natureza de acompanhamento de job, não domínio de negócio
 * tradicional, pedindo avaliação explícita se o caso de uso não ficasse
 * claro). Confirmado contra dados reais desta central de demonstração:
 * existem 5 jobs de importação em lote de equipamentos reais, todos com
 * status `done_with_errors` — ou seja, HISTÓRICO REAL DE OPERAÇÕES DE
 * IMPORTAÇÃO já executadas (não fila de jobs pendentes/em execução). O
 * caso de uso ficou claro após o teste: suporte/diagnóstico ("esta
 * importação de equipamentos teve erro? quais linhas falharam e por quê?")
 * — mesmo papel que `search_operations` (Epic 19) e `search_reports`
 * (Epic 13) cumprem para outros tipos de job/registro operacional deste
 * projeto. Implementado sem bloqueio; papel e utilidade documentados aqui
 * e no PR em vez de apenas implementado mecanicamente.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: `perPage=1` retornou
 *     os 5 itens completos (ignorado); `per_page=1` retornou 1 item
 *     corretamente. Implementado com `per_page` desde o início.
 *   - `order[id]` confirmado FUNCIONANDO corretamente nas duas direções
 *     (`ASC`: 126,127,361,362,487; `DESC`: 487,362,361,127,126).
 *   - `filters[created_at][gte]` (documentado, opcional) não testado
 *     isoladamente nesta rodada (dataset pequeno, sem uma data de corte
 *     óbvia para verificar); exposto mesmo assim por ser um filtro simples
 *     e bem documentado (formato `date-time`).
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

const SOURCE_ENDPOINT = "GET /v1.0/equipments/files";

export const searchEquipmentImportRequestsInputSchema = z.object({
  central: centralSchema,
  created_after: z.string().optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchEquipmentImportRequestsInput = z.infer<typeof searchEquipmentImportRequestsInputSchema>;

export interface SearchEquipmentImportRequestsData {
  import_requests: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchEquipmentImportRequestsTool(
  deps: WebEquipmentsToolDeps,
): DomainToolRegistration<SearchEquipmentImportRequestsInput, SearchEquipmentImportRequestsData> {
  const definition: ToolDefinition<SearchEquipmentImportRequestsInput, SearchEquipmentImportRequestsData> = {
    name: "search_equipment_import_requests",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEquipmentImportRequestsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/equipments/files",
        query: {
          "filters[created_at][gte]": input.created_after,
          "order[id]": input.sort_direction,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { import_requests: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_equipment_import_requests",
      description: "Search historical bulk equipment import jobs (file uploads and their processing status) within an authorized central.",
      intent: "read",
      domain: "web_equipments",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
