/**
 * US-078 — Consultar métricas agregadas de mensagens de notificação.
 * Endpoint: GET /v1.0/notifications/messaging/messages/analytics (não
 * depreciado, oauth2Password/GetrakWeb — token delegado).
 *
 * Confirmado contra chamada real em homologação nesta rodada:
 *   - Nenhum parâmetro é obrigatório: chamada sem `start_at`/`end_at`
 *     funciona e retorna a agregação sobre todo o histórico disponível
 *     (`{total_sent: 2253, total_viewed: 494, reading_rate: 21.9}`).
 *   - Com `start_at`/`end_at` (formato `YYYY-MM-DD`, mesmo par documentado
 *     no openapi.json), a agregação é recalculada sobre o intervalo
 *     (`{total_sent: 1023, total_viewed: 215, reading_rate: 21}`).
 *   - `reading_rate` vem como NÚMERO DECIMAL real (ex.: `21.9`) — o
 *     openapi.json documenta `reading_rate` como inteiro. Repassado como
 *     veio, não arredondado/truncado para bater com o schema documentado
 *     (a resposta real é a fonte de verdade, CLAUDE.md Seção 7).
 *   - Não há paginação neste endpoint (resposta é um único objeto agregado,
 *     não uma lista) — nenhum uso de `paginationInputShape`/
 *     `extractPagePerPageEnvelope` aqui, diferente de `search_messages`.
 *
 * Este endpoint não expõe conteúdo de mensagem individual (`body`/`title`)
 * — só contadores agregados — então a tensão de mascaramento de conteúdo
 * documentada em `domain/notifications/shared.ts` não se aplica a esta
 * tool.
 */

import { z } from "zod";
import type { DomainToolRegistration } from "../../server.js";
import type { ToolDefinition } from "../../foundation/tool-runtime.js";
import { callGetrakWebEndpoint, centralSchema, normalizeItem, type NotificationsToolDeps } from "./shared.js";

const SOURCE_ENDPOINT = "GET /v1.0/notifications/messaging/messages/analytics";

export const getMessagesAnalyticsInputSchema = z.object({
  central: centralSchema,
  start_at: z.string().optional(),
  end_at: z.string().optional(),
});

export type GetMessagesAnalyticsInput = z.infer<typeof getMessagesAnalyticsInputSchema>;

export interface GetMessagesAnalyticsData {
  analytics: Record<string, unknown>;
}

export function createGetMessagesAnalyticsTool(
  deps: NotificationsToolDeps,
): DomainToolRegistration<GetMessagesAnalyticsInput, GetMessagesAnalyticsData> {
  const definition: ToolDefinition<GetMessagesAnalyticsInput, GetMessagesAnalyticsData> = {
    name: "get_messages_analytics",
    risk: "low",
    requiresCentral: true,
    inputSchema: getMessagesAnalyticsInputSchema,
    getCentral: (input) => input.central,
    handler: async (input, ctx) => {
      const raw = await callGetrakWebEndpoint<Record<string, unknown>>({
        deps,
        path: "/v1.0/notifications/messaging/messages/analytics",
        query: {
          start_at: input.start_at,
          end_at: input.end_at,
        },
        environment: ctx.environment,
        central: input.central,
        userId: ctx.consumer.consumer_id,
      });

      const analytics = normalizeItem(raw && typeof raw === "object" ? raw : {});

      return {
        data: { analytics },
        endpoints: [SOURCE_ENDPOINT],
        authScheme: "oauth2Password",
      };
    },
  };

  return {
    catalogEntry: {
      name: "get_messages_analytics",
      description: "Get aggregated engagement metrics (sent/viewed/reading rate) for notification messages within an authorized central.",
      intent: "read",
      domain: "notifications",
      risk: "low",
      environments: "all",
      version: "1.0.0",
    },
    definition,
  };
}
