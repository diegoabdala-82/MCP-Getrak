/**
 * US-034 — Consultar centrais.
 * Endpoint: GET /v0.2/centrais/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: este endpoint **não declara nenhum parâmetro de
 * request** — nem paginação (limit/offset/limite), nem `sistema`/central.
 * Retorna a lista completa de centrais com integração ativa; resposta é
 * array de `{endereco, id_central, sistema, site_sis}`.
 *
 * DIVERGÊNCIA/RISCO SINALIZADO (não decidido silenciosamente): diferente de
 * get_vehicle_category (também sem parâmetros, mas lista pequena e estática
 * de categorias), este endpoint pode retornar um número não limitado de
 * centrais — potencialmente todas as centrais da credencial técnica, não
 * filtráveis por request. Por isso, ao contrário de get_vehicle_category,
 * aplicamos paginação client-side (`createClientSideSliceAdapter`, mesmo
 * padrão já usado em Locations para endpoints sem paginação nativa — ver
 * get-vehicle-paths.ts) para respeitar o guardrail padrão de página/tamanho
 * (CLAUDE.md Seção 4) em vez de devolver uma lista potencialmente grande de
 * uma vez.
 *
 * `central` continua sendo exigido como parâmetro de entrada da tool (gate
 * de autorização/resolução de credencial do MCP, CLAUDE.md Seção 3), mesmo
 * não sendo enviado ao endpoint — mesmo tratamento de get_vehicle_category e
 * get_equipment_bench_position, que também não repassam central ao endpoint
 * real por ele não o aceitar.
 *
 * RISCO DE ISOLAMENTO SINALIZADO (US-002/US-034, não resolvido nesta PR —
 * decisão explícita de manter e documentar, não corrigir silenciosamente):
 * o AC de US-034 exige que esta tool "respeite o isolamento (RF03)", mas o
 * endpoint real não aceita nenhum parâmetro para filtrar por central (ver
 * acima). US-001 descreve a credencial técnica como resolvida "por
 * ambiente", não "por central" — ou seja, não há confirmação de que a
 * credencial `oauth2ClientCredentials` seja central-scoped. O guard de
 * isolamento do MCP (`CentralAuthorizationGuard`, US-002) só valida a
 * central de ENTRADA contra a lista autorizada do consumidor antes da
 * chamada — ele não filtra o CONTEÚDO da resposta. Na prática, isso
 * significa que a resposta desta tool pode incluir centrais além da
 * solicitada/autorizada, caso a credencial não seja central-scoped no lado
 * da API Core. Não implementamos filtragem client-side por central porque o
 * mapeamento entre os campos da resposta (`id_central`, `site_sis`) e o
 * identificador de central usado nas demais tools não está confirmado —
 * filtrar às cegas poderia tanto vazar dados quanto descartar dados
 * legítimos. Sinalizado explicitamente via `warnings` na resposta; decisão
 * de manter assim (vs. bloquear/filtrar) validada com o dono do produto —
 * aguardando confirmação da Engenharia sobre o escopo real da credencial
 * técnica antes de resolver definitivamente.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { createClientSideSliceAdapter, normalizePagination } from "../../foundation/pagination/pagination.js";
import {
  callAccountsEndpoint,
  centralSchema,
  normalizeItem,
  paginationInputShape,
  type AccountsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/centrais/integracao";

export const getCentralsInputSchema = z.object({
  central: centralSchema,
  ...paginationInputShape,
});

export type GetCentralsInput = z.infer<typeof getCentralsInputSchema>;

export interface GetCentralsData {
  centrals: Record<string, unknown>[];
  pagination: ReturnType<typeof normalizePagination> & { total_items: number | null; has_more: boolean | null };
}

const sliceAdapter = createClientSideSliceAdapter<Record<string, unknown>>({
  extractItems: (raw) => (Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []),
});

export function createGetCentralsTool(
  deps: AccountsToolDeps,
): DomainToolRegistration<GetCentralsInput, GetCentralsData> {
  const definition: ToolDefinition<GetCentralsInput, GetCentralsData> = {
    name: "get_centrals",
    risk: "low",
    requiresCentral: true,
    inputSchema: getCentralsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callAccountsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/centrais/integracao",
        query: {},
        environment: ctx.environment,
        central: input.central,
      });

      const pagination = normalizePagination(input);
      const { items, meta } = sliceAdapter.fromUpstreamResponse(raw as Record<string, unknown>, pagination);

      return {
        data: { centrals: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        warnings: [
          "This tool cannot filter results by central at the source (the endpoint accepts no request " +
            "parameters); the response may include centrals beyond the one requested if the technical " +
            "credential is not central-scoped (unconfirmed — see US-001/US-002).",
        ],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_centrals",
      description: "List centrals with active integrations.",
      intent: "read",
      domain: "accounts",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
