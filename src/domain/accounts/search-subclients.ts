/**
 * US-031 — Buscar subclientes cadastrados.
 * Endpoint: GET /v0.2/subclientes/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais `sistema (required), limit,
 * offset, id, id_veiculo, cliente, cnpj, nome`; resposta é array de objetos
 * de subcliente (`ativo, cel1, cel2, cliente, cnpj, descricao, email_c1,
 * email_c2, endereco, ...`). Paginação real = limit/offset (mesmo nome de
 * clientes/integracao, diferente de perfis/integracao neste domínio).
 *
 * DIVERGÊNCIA CONHECIDA (documentada, não corrigida silenciosamente):
 * `id_veiculo` é `integer` aqui, mas `string` no endpoint irmão
 * `/v0.2/clientes/integracao` (US-030) — tipos reais diferentes para o
 * "mesmo" filtro conceitual em dois endpoints do mesmo domínio. Cada tool
 * segue o tipo real do seu próprio endpoint em vez de forçar consistência
 * artificial entre elas.
 *
 * `sistema` É `required: true` neste endpoint (diferente de clientes/perfis,
 * onde é opcional-mas-enviado-sempre) — de qualquer forma já enviado
 * explicitamente por convenção do domínio, então não há efeito prático.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import {
  buildPaginationMeta,
  buildUpstreamPagination,
  callAccountsEndpoint,
  centralSchema,
  extractArray,
  normalizeItem,
  paginationInputShape,
  type AccountsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v0.2/subclientes/integracao";

export const searchSubclientsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().nonnegative().optional(),
  vehicle_id: z.number().int().nonnegative().optional(),
  client_id: z.number().int().nonnegative().optional(),
  cnpj: z.string().optional(),
  name: z.string().optional(),
  ...paginationInputShape,
});

export type SearchSubclientsInput = z.infer<typeof searchSubclientsInputSchema>;

export interface SearchSubclientsData {
  subclients: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createSearchSubclientsTool(
  deps: AccountsToolDeps,
): DomainToolRegistration<SearchSubclientsInput, SearchSubclientsData> {
  const definition: ToolDefinition<SearchSubclientsInput, SearchSubclientsData> = {
    name: "search_subclients",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchSubclientsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limit");

      const raw = await callAccountsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/subclientes/integracao",
        query: {
          sistema: input.central,
          id: input.id,
          id_veiculo: input.vehicle_id,
          cliente: input.client_id,
          cnpj: input.cnpj,
          nome: input.name,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const subclients = extractArray(raw).map(normalizeItem);

      return {
        data: {
          subclients,
          pagination: buildPaginationMeta(subclients, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_subclients",
      description: "Search registered subclients by identifier, name, CNPJ or supported filters within an authorized central.",
      intent: "read",
      domain: "accounts",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
