import { describe, expect, it } from "vitest";
import { createGetMessagesAnalyticsTool } from "../../../src/domain/notifications/get-messages-analytics.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-078 — get_messages_analytics", () => {
  it("retorna as métricas agregadas quando nenhum filtro de data é informado", async () => {
    const fake = createFakeApiCoreClient({ total_sent: 2253, total_viewed: 494, reading_rate: 21.9 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.analytics).toEqual({ total_sent: 2253, total_viewed: 494, reading_rate: 21.9 });
    expect(result.authScheme).toBe("oauth2Password");
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/notifications/messaging/messages/analytics",
        query: { start_at: undefined, end_at: undefined },
      }),
    );
  });

  it("repassa start_at/end_at para a query e preserva reading_rate decimal (não arredonda para inteiro)", async () => {
    const fake = createFakeApiCoreClient({ total_sent: 1023, total_viewed: 215, reading_rate: 21 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", start_at: "2026-08-01", end_at: "2026-08-19" }),
      ctx,
    );

    expect(result.data.analytics).toEqual({ total_sent: 1023, total_viewed: 215, reading_rate: 21 });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: { start_at: "2026-08-01", end_at: "2026-08-19" } }),
    );
  });

  it("retorna métricas zeradas normalizadas quando o intervalo filtrado não tem nenhuma mensagem", async () => {
    const fake = createFakeApiCoreClient({ total_sent: 0, total_viewed: 0, reading_rate: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMessagesAnalyticsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", start_at: "2000-01-01", end_at: "2000-01-02" }),
      ctx,
    );

    expect(result.data.analytics).toEqual({ total_sent: 0, total_viewed: 0, reading_rate: 0 });
  });
});
