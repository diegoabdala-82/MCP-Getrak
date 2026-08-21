/**
 * US-067 — Consultar detalhe de usuário (Getrak Web).
 * Endpoint: GET /v1.0/users/{id} (não depreciado, oauth2Password/GetrakWeb —
 * token delegado).
 *
 * DIVERGÊNCIA REAL CONFIRMADA contra homologação nesta rodada (mesma
 * disciplina do Epic 3/10, CLAUDE.md Seção 7) — o shape documentado no
 * openapi.json (`{client: {...}, client_id, fullName, id, site}`) NÃO bate
 * com a resposta real observada:
 *   - Resposta real (sem `fields[]`): `{id, full_name, client, subclient, central}`
 *     — chave `full_name` (snake_case), não `fullName`; inclui `subclient`
 *     e `central` (objeto, vazio `{}` nos usuários testados — não confirmado
 *     se é sempre assim); `client`/`subclient` nulos quando não aplicável,
 *     ou objeto `{id, name, central, status, business_phone, mobile_phone,
 *     document}` quando o usuário tem cliente associado.
 *   - `fields[]` (query) usa os identificadores CAMELCASE documentados no
 *     openapi.json (`id`, `fullName`, `site`, `clientId`) como SELETOR —
 *     mas as chaves adicionadas à resposta saem em snake_case (`site`,
 *     `client_id`). Enviar um nome de campo que não esteja nessa lista fixa
 *     (ex.: `full_name`, o nome real de saída) derruba o endpoint com
 *     HTTP 500 ("Property ... was not found in User").
 * Por isso `fields[]` NÃO é exposto como parâmetro de entrada da tool (um
 * valor arbitrário do consumidor poderia derrubar a chamada) — a tool
 * sempre solicita o conjunto fixo e confirmado (`id, fullName, site,
 * clientId`) para obter a resposta mais completa possível de forma estável;
 * a tool cria sua própria normalização (CLAUDE.md Seção 3), então o
 * consumidor nunca vê essa complexidade.
 *
 * 404 confirmado: `{"status":404,"error":"User"}` — normalizado para
 * `USER_NOT_FOUND` (AC da spec).
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type WebUsersToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/users/{id}";

/** Seletor fixo e confirmado — ver comentário do topo do arquivo. */
const FIXED_FIELDS_SELECTOR = ["id", "fullName", "site", "clientId"];

export const getUserDetailsInputSchema = z.object({
  central: centralSchema,
  user_id: z.number().int().positive(),
});

export type GetUserDetailsInput = z.infer<typeof getUserDetailsInputSchema>;

export interface GetUserDetailsData {
  user: Record<string, unknown>;
}

export function createGetUserDetailsTool(
  deps: WebUsersToolDeps,
): DomainToolRegistration<GetUserDetailsInput, GetUserDetailsData> {
  const definition: ToolDefinition<GetUserDetailsInput, GetUserDetailsData> = {
    name: "get_user_details",
    risk: "low",
    requiresCentral: true,
    inputSchema: getUserDetailsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: `/v1.0/users/${encodeURIComponent(String(input.user_id))}`,
        query: { "fields[]": FIXED_FIELDS_SELECTOR },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
        notFoundCode: "USER_NOT_FOUND",
      });

      const user = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { user },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_user_details",
      description: "Get the details of a specific Getrak Web user by id within an authorized central.",
      intent: "read",
      domain: "web_users",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
