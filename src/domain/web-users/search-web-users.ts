/**
 * US-068 — Buscar usuários (Getrak Web).
 * Endpoint: GET /v1.1/users (não depreciado, oauth2Password/GetrakWeb —
 * token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Resposta é o mesmo envelope de paginação real já usado no Epic 10:
 *     `{data: [...], page, pages, total}` (`extractPagePerPageEnvelope`).
 *   - MESMO BUG DE PAGINAÇÃO já corrigido no Epic 10 (CLAUDE.md Seção 7):
 *     `perPage` (identificador do `$ref` no openapi.json) é silenciosamente
 *     ignorado pela API real, que aplica seu próprio tamanho de página
 *     padrão (25); o nome real do parâmetro de wire é `per_page`.
 *     Implementado aqui já com `per_page` desde o início — confirmado
 *     empiricamente antes de escrever este código, não assumido por analogia.
 *   - Filtro `filters[<campo>][inc]` (estilo deepObject) confirmado
 *     funcional para `full_name` e, por extensão de mesmo padrão, aplicado
 *     também a `username` (mesmo shape documentado no openapi.json). Filtro
 *     sem correspondência retorna lista vazia normalizada (`{data: [],
 *     total: 0, pages: 0, page: 1}`), nunca erro — confirmado.
 *   - `order[<coluna>]` (deepObject, ASC/DESC) — nomes de coluna são os
 *     documentados no openapi.json, incluindo o typo real `updatad_at`
 *     (não "updated_at") — enviar a grafia "corrigida" arriscaria repetir o
 *     mesmo erro de silenciosamente não filtrar nada (mesma lição do bug de
 *     paginação); mantido fiel ao nome real.
 *
 * ESCOPO DELIBERADAMENTE REDUZIDO (sinalizado, não decisão silenciosa): o
 * openapi.json também documenta filtros de array aninhado
 * (`filters[id][in][]`, `filters[client_id][in][]`, `filters[type][in][]`)
 * e `fields[]`/`created_at` (gt/gte/lt/lte) para este endpoint — nenhum
 * desses foi testado empiricamente nesta rodada (o `fields[]` deste
 * endpoint em particular, inclusive, nem teve seu formato de wire real
 * confirmado — comma-joined vs. repetido vs. array aninhado variam mesmo
 * dentro do próprio Epic 10, ver domain/accessories/search-accessories.ts
 * vs. domain/perimeters/search-geofences.ts). Não implementados para não
 * assumir formato de wire não confirmado (mesma disciplina de ED-01/CLAUDE.md
 * Seção 7) — item para validação empírica futura, não uma limitação
 * definitiva de produto.
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
  type WebUsersToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.1/users";

const USER_TYPES = ["admin", "operator", "client", "subclient", "atende"] as const;
const SORTABLE_FIELDS = ["created_at", "email", "full_name", "login", "site", "updatad_at"] as const;

export const searchWebUsersInputSchema = z.object({
  central: centralSchema,
  full_name_contains: z.string().optional(),
  username_contains: z.string().optional(),
  type: z.enum(USER_TYPES).optional(),
  is_active: z.enum(["Y", "N"]).optional(),
  profile_id: z.number().int().positive().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchWebUsersInput = z.infer<typeof searchWebUsersInputSchema>;

export interface SearchWebUsersData {
  users: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchWebUsersTool(
  deps: WebUsersToolDeps,
): DomainToolRegistration<SearchWebUsersInput, SearchWebUsersData> {
  const definition: ToolDefinition<SearchWebUsersInput, SearchWebUsersData> = {
    name: "search_web_users",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchWebUsersInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.1/users",
        query: {
          "filters[full_name][inc]": input.full_name_contains,
          "filters[username][inc]": input.username_contains,
          "filters[type]": input.type,
          "filters[is_active]": input.is_active,
          "filters[profile_id]": input.profile_id,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { users: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_web_users",
      description: "Search Getrak Web users by name, username, type or status within an authorized central.",
      intent: "read",
      domain: "web_users",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
