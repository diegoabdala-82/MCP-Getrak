/**
 * US-030 — Buscar clientes cadastrados.
 * Endpoint: GET /v0.2/clientes/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais `id, name, sistema, ordem,
 * limit, offset, cnpj, id_veiculo`; resposta é array de objetos de cliente
 * (`ativo, cel, cel2, cnpj, descricao, email, email2, endereco, ...`).
 * Paginação real = limit/offset (não "limite", diferente de US-033/perfis
 * neste mesmo domínio — heterogeneidade confirmada, não assumida).
 *
 * `sistema` não é `required` no openapi.json para este endpoint em
 * específico, mas a descrição do parâmetro é explicitamente "Central" —
 * mesma leitura já aplicada em Veículos/Equipamentos (ver domain/vehicles/shared.ts):
 * enviado explicitamente desde o início, não deixado como opcional silencioso.
 *
 * `cnpj`/`email`/`cel` são dados sensíveis (CLAUDE.md Seção 8) — mascarados
 * apenas na auditoria, nunca na resposta normalizada ao consumidor
 * autorizado (mesmo tratamento de get_vehicle_client_link).
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

const SOURCE_ENDPOINT = "GET /v0.2/clientes/integracao";

export const searchClientsInputSchema = z.object({
  central: centralSchema,
  id: z.number().int().positive().optional(),
  name: z.string().optional(),
  cnpj: z.string().optional(),
  vehicle_id: z.string().optional(),
  sort: z.string().optional(),
  ...paginationInputShape,
});

export type SearchClientsInput = z.infer<typeof searchClientsInputSchema>;

export interface SearchClientsData {
  clients: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createSearchClientsTool(
  deps: AccountsToolDeps,
): DomainToolRegistration<SearchClientsInput, SearchClientsData> {
  const definition: ToolDefinition<SearchClientsInput, SearchClientsData> = {
    name: "search_clients",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchClientsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limit");

      const raw = await callAccountsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/clientes/integracao",
        query: {
          sistema: input.central,
          id: input.id,
          name: input.name,
          cnpj: input.cnpj,
          id_veiculo: input.vehicle_id,
          ordem: input.sort,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const clients = extractArray(raw).map(normalizeItem);

      return {
        data: {
          clients,
          pagination: buildPaginationMeta(clients, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_clients",
      description: "Search registered clients by identifier, name, CNPJ or supported filters within an authorized central.",
      intent: "read",
      domain: "accounts",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
