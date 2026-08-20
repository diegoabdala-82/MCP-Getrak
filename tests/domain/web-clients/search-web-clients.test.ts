import { describe, expect, it } from "vitest";
import { createSearchWebClientsTool } from "../../../src/domain/web-clients/search-web-clients.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-061 — search_web_clients", () => {
  it("retorna clientes normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 919531, name: "Getrak Laboratório" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebClientsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", name_contains: "Getrak" }),
      ctx,
    );

    expect(result.data.clients).toEqual([{ id: 919531, name: "Getrak Laboratório" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação para a query real, com sufixo [] em filters[id][in] e per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebClientsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      ids: [919531, 919576],
      status: "Y",
      type: "individual",
      fields: ["id", "name", "city"],
      sort_by: "id",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/client",
        query: expect.objectContaining({
          "filters[id][in][]": [919531, 919576],
          "filters[status]": "Y",
          "filters[type]": "individual",
          "fields[]": ["id", "name", "city"],
          "order[id]": "DESC",
          page: 2,
          per_page: 10,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum cliente corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebClientsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", ids: [999999999] }),
      ctx,
    );

    expect(result.data.clients).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });

  it("rejeita status/type/fields fora do enum documentado", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebClientsTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", status: "X" })).toThrow();
    expect(() => definition.inputSchema.parse({ central: "central-1", type: "company" })).toThrow();
    expect(() => definition.inputSchema.parse({ central: "central-1", fields: ["document"] })).toThrow();
  });
});
