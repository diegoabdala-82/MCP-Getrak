/**
 * US-033 — Consultar perfis de acesso.
 * Endpoint: GET /v0.2/perfis/integracao (v0.2, vigente,
 * oauth2ClientCredentials/Integracao). Confirmado contra
 * reference/openapi.json: query params reais `limite, sistema, ordem,
 * offset`; resposta é array de `{id, nome, tipo}` (`tipo`: 2=Operator,
 * 3=Client, 4=Subclient). Paginação real = limite/offset (nome "limite",
 * diferente de clientes/subclientes neste mesmo domínio).
 *
 * NOME DA TOOL: a spec sugeriu `list_user_profiles`, mas o código já
 * estabelecido em Epic 2/4 não usa o prefixo `list_` em nenhuma tool —
 * `get_` é o padrão para consultas/listagens sem um espaço de filtros
 * amplo (ver get_vehicle_category, mesmo formato de central+paginação sem
 * filtro por campo específico). Renomeado para `get_user_profiles` para
 * manter a convenção consistente com o restante do catálogo; sinalizado no
 * PR para confirmação.
 *
 * `sistema` (via $ref `#/components/parameters/sistema`) não é `required`
 * no openapi.json, mas segue a mesma leitura já aplicada no domínio
 * (parâmetro central, enviado explicitamente).
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

const SOURCE_ENDPOINT = "GET /v0.2/perfis/integracao";

export const getUserProfilesInputSchema = z.object({
  central: centralSchema,
  sort: z.string().optional(),
  ...paginationInputShape,
});

export type GetUserProfilesInput = z.infer<typeof getUserProfilesInputSchema>;

export interface GetUserProfilesData {
  profiles: Record<string, unknown>[];
  pagination: ReturnType<typeof buildPaginationMeta>;
}

export function createGetUserProfilesTool(
  deps: AccountsToolDeps,
): DomainToolRegistration<GetUserProfilesInput, GetUserProfilesData> {
  const definition: ToolDefinition<GetUserProfilesInput, GetUserProfilesData> = {
    name: "get_user_profiles",
    risk: "low",
    requiresCentral: true,
    inputSchema: getUserProfilesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildUpstreamPagination(input, "limite");

      const raw = await callAccountsEndpoint<unknown>({
        apiCoreClient: deps.apiCoreClient,
        path: "/v0.2/perfis/integracao",
        query: {
          sistema: input.central,
          ordem: input.sort,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
      });

      const profiles = extractArray(raw).map(normalizeItem);

      return {
        data: {
          profiles,
          pagination: buildPaginationMeta(profiles, upstreamPagination.page, upstreamPagination.page_size),
        },
        endpoints: [SOURCE_ENDPOINT],
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_user_profiles",
      description: "List registered access profiles within an authorized central.",
      intent: "read",
      domain: "accounts",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
