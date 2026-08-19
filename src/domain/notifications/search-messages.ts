/**
 * US-077 — Buscar mensagens de notificação.
 * Endpoint: GET /v1.0/notifications/messaging/messages (não depreciado,
 * oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Mesmo envelope de paginação real `{data: [...], page, pages, total}`
 *     do resto do Epic 10/16/17.
 *   - MESMO BUG DE PAGINAÇÃO `perPage`/`per_page`: confirmado empiricamente
 *     antes de escrever este código (25 itens com `perPage=2`, 2 itens com
 *     `per_page=2`, mesmo `total`). Implementado com `per_page` desde o
 *     início.
 *   - `is_automatic` vem como BOOLEANO real (`true`/`false`) — o
 *     openapi.json documenta `is_automatic` como inteiro `0`/`1`. Repassado
 *     como veio (booleano), não convertido para bater com o schema
 *     documentado (a resposta real é a fonte de verdade, CLAUDE.md Seção 7).
 *   - Filtro `filters[search]`/`filters[subject]`/`filters[status]` seguem o
 *     mesmo estilo `deepObject` já usado em outros domínios GetrakWeb; não
 *     testados individualmente nesta rodada (o `openapi.json`, apesar de já
 *     ter se mostrado impreciso em outros pontos deste mesmo achado —
 *     ver `responses.200` misturado com um `$ref` de erro 400, claramente
 *     um artefato de documentação — documenta esses 3 de forma consistente
 *     com o padrão `filters[x]` já confirmado em `search_web_vehicles`/
 *     `search_geofences`).
 *
 * CONTEÚDO SENSÍVEL (`body`/`title`): ver decisão documentada em
 * `domain/notifications/shared.ts` — mantido o mesmo padrão transversal do
 * projeto (pass-through na resposta, mascarado só na auditoria), não uma
 * exceção pontual inventada para este domínio. Sinalizado no PR.
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
  type NotificationsToolDeps,
} from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/notifications/messaging/messages";

const MESSAGE_SUBJECTS = ["finance", "marketing", "notice", "maintenance"] as const;
/** 1=Sent, 2=Draft, 3=Scheduled, 4=Stopped (openapi.json). */
const MESSAGE_STATUSES = [1, 2, 3, 4] as const;
const SORTABLE_FIELDS = ["last_sent_date", "audience", "status"] as const;

export const searchMessagesInputSchema = z.object({
  central: centralSchema,
  search: z.string().optional(),
  subject: z.enum(MESSAGE_SUBJECTS).optional(),
  status: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  automatic: z.boolean().optional(),
  title_contains: z.string().optional(),
  body_contains: z.string().optional(),
  last_sent_after: z.string().optional(),
  last_sent_before: z.string().optional(),
  sort_by: z.enum(SORTABLE_FIELDS).optional(),
  sort_direction: z.enum(["ASC", "DESC"]).optional(),
  ...paginationInputShape,
});

export type SearchMessagesInput = z.infer<typeof searchMessagesInputSchema>;

export interface SearchMessagesData {
  messages: Record<string, unknown>[];
  pagination: ReturnType<typeof extractPagePerPageEnvelope>["meta"];
}

export function createSearchMessagesTool(
  deps: NotificationsToolDeps,
): DomainToolRegistration<SearchMessagesInput, SearchMessagesData> {
  const definition: ToolDefinition<SearchMessagesInput, SearchMessagesData> = {
    name: "search_messages",
    risk: "low",
    requiresCentral: true,
    inputSchema: searchMessagesInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const upstreamPagination = buildPagePerPagePagination(input, "per_page");
      const sortQuery = input.sort_by ? { [`order[${input.sort_by}]`]: input.sort_direction ?? "ASC" } : {};

      const raw = await callGetrakWebEndpoint<unknown>({
        deps,
        path: "/v1.0/notifications/messaging/messages",
        query: {
          "filters[search]": input.search,
          "filters[subject]": input.subject,
          "filters[status]": input.status,
          "filters[automatic]": input.automatic === undefined ? undefined : input.automatic ? 1 : 0,
          "filters[title]": input.title_contains,
          "filters[body]": input.body_contains,
          "filters[last_sent_start]": input.last_sent_after,
          "filters[last_sent_end]": input.last_sent_before,
          ...sortQuery,
          ...upstreamPagination.query,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const { items, meta } = extractPagePerPageEnvelope(raw, upstreamPagination.page, upstreamPagination.page_size);

      return {
        data: { messages: items.map(normalizeItem), pagination: meta },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "search_messages",
      description: "Search notification messages sent to clients within an authorized central.",
      intent: "read",
      domain: "notifications",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
