/**
 * US-064 — Buscar requisições de importação de entidade (cliente/subcliente).
 * Endpoint: GET /v1.0/clients/import-entity (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * UTILIDADE REAL — avaliada conforme pedido (mesma natureza operacional de
 * job de importação já observada em US-100/Epic 21). Confirmado contra
 * dados reais desta central de demonstração: 42 requisições reais de
 * importação em lote de clientes/subclientes (31 `client` + 11
 * `subclient`, confirmado com `filters[entity]`), todas com status
 * `done_with_errors`. Mesmo caso de uso já validado em US-100/101/102
 * (Epic 21): histórico real de importações executadas, suporte/
 * diagnóstico de erros de carga em lote — não um domínio de negócio
 * tradicional, mas um caso de uso claro e real. Implementado sem bloqueio.
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page` do resto do domínio
 *     Getrak Web: `perPage=1` retornou o padrão de 25 (ignorado);
 *     `per_page=1` respeitado corretamente.
 *   - `filters[entity]` (`client`/`subclient`) confirmado funcionando —
 *     31 + 11 = 42, exatamente o total sem filtro.
 *   - `filters[user_id]` (documentado, opcional) não testado
 *     isoladamente nesta rodada; exposto mesmo assim por ser um filtro
 *     simples de igualdade exata, mesmo formato já confirmado em outros
 *     endpoints deste domínio.
 *   - Nenhum parâmetro `order[x]` é documentado para este endpoint — não
 *     exposto parâmetro de ordenação nesta tool.
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
  type WebClientsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/clients/import-entity";

export const searchEntityImportRequestsInputSchema = z.object({
  central: centralSchema,
  entity: z.enum(["client", "subclient"]).optional(),
  user_id: z.number().int().optional(),
  ...paginationInputShape,
});

export type SearchEntityImportRequestsInput = z.infer<typeof searchEntityImportRequestsInputSchema>;

export interface SearchEntityImportRequestsData {
  import_requests: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchEntityImportRequestsTool(
  deps: WebClientsToolDeps,
): DomainToolRegistration<SearchEntityImportRequestsInput, SearchEntityImportRequestsData> {
  const definition: ToolDefinition<SearchEntityImportRequestsInput, SearchEntityImportRequestsData> = {
    name: "search_entity_import_requests",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchEntityImportRequestsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/clients/import-entity",
        query: {
          "filters[entity]": input.entity,
          "filters[user_id]": input.user_id,
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
      name: "search_entity_import_requests",
      description: "Search historical bulk client/subclient import jobs (file uploads and their processing status) within an authorized central.",
      intent: "read",
      domain: "web_clients",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
