import { describe, expect, it } from "vitest";
import { createSearchMessagesTool } from "../../../src/domain/notifications/search-messages.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-077 — search_messages", () => {
  it("retorna mensagens normalizadas e paginadas dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 1, title: "Aviso de manutenção", is_automatic: false }],
      page: 1,
      pages: 1,
      total: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMessagesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "manutenção" }),
      ctx,
    );

    expect(result.data.messages).toEqual([{ id: 1, title: "Aviso de manutenção", is_automatic: false }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação/ordenação para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMessagesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      search: "cobrança",
      subject: "finance",
      status: 1,
      automatic: true,
      title_contains: "fatura",
      body_contains: "pagamento",
      last_sent_after: "2026-08-01",
      last_sent_before: "2026-08-19",
      sort_by: "last_sent_date",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/notifications/messaging/messages",
        query: {
          "filters[search]": "cobrança",
          "filters[subject]": "finance",
          "filters[status]": 1,
          "filters[automatic]": 1,
          "filters[title]": "fatura",
          "filters[body]": "pagamento",
          "filters[last_sent_start]": "2026-08-01",
          "filters[last_sent_end]": "2026-08-19",
          "order[last_sent_date]": "DESC",
          page: 2,
          per_page: 10,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma mensagem corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMessagesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "xyzxyzxyznaoexiste123" }),
      ctx,
    );

    expect(result.data.messages).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });

  it("rejeita subject/status fora do enum documentado", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchMessagesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", subject: "urgent" })).toThrow();
    expect(() => definition.inputSchema.parse({ central: "central-1", status: 9 })).toThrow();
  });
});
