import { describe, expect, it } from "vitest";
import { createSearchAccessoryCategoriesTool } from "../../../src/domain/accessories/search-accessory-categories.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-036 — search_accessory_categories", () => {
  it("retorna categorias normalizadas", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, name: "Rastreadores" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoryCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", name: "Rastreadores" }), ctx);

    expect(result.data.categories).toEqual([{ id: 1, name: "Rastreadores" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz o filtro de nome para filters[name][inc]", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoryCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", name: "Rastr" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/accessories/categories",
        query: { "filters[name][inc]": "Rastr", page: 1, per_page: 50 },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma categoria corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchAccessoryCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.categories).toEqual([]);
  });
});
