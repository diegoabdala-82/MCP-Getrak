import { describe, expect, it } from "vitest";
import { DEFAULT_DELEGATED_SESSION_ID } from "../../../src/foundation/auth/delegated-token-manager.js";
import { createSearchAccessoriesTool } from "../../../src/domain/accessories/search-accessories.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-035 — search_accessories", () => {
  it("retorna acessórios normalizados dentro da central autorizada, usando token delegado", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, name: "Chip" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoriesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "chip" }),
      ctx,
    );

    expect(result.data.accessories).toEqual([{ id: 1, name: "Chip" }]);
    expect(result.data.pagination).toMatchObject({ page: 1, page_size: 50, total_items: 1, has_more: false });
    expect(result.endpoints).toEqual(["GET /v1.0/accessories"]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação para os query params reais e resolve o token via DelegatedTokenManager", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 2, pages: 5, total: 100 });
    const delegated = createFakeDelegatedTokenManager("token-xyz");
    const { definition } = createSearchAccessoriesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      search: "chip",
      fields: "id,name",
      sort_by: "name",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    const result = await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/accessories",
        query: {
          "fields[]": "id,name",
          "filters[search][inc]": "chip",
          "order[name]": "DESC",
          page: 2,
          perPage: 10,
        },
        central: "central-1",
        authScheme: "oauth2Password",
        delegatedTokenProvider: expect.any(Function),
      }),
    );

    const call = fake.get.mock.calls[0][0];
    await expect(call.delegatedTokenProvider()).resolves.toBe("token-xyz");
    expect(delegated.getAccessToken).toHaveBeenCalledWith({
      environment: "homologation",
      central: "central-1",
      userId: "c",
      sessionId: DEFAULT_DELEGATED_SESSION_ID,
    });
    expect(result.data.pagination).toMatchObject({ page: 2, page_size: 10, total_items: 100, has_more: true });
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum acessório corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoriesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.accessories).toEqual([]);
  });

  it("rejeita sort_by fora dos campos ordenáveis documentados", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoriesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() =>
      definition.inputSchema.parse({ central: "central-1", sort_by: "not-a-real-field" }),
    ).toThrow();
  });
});
