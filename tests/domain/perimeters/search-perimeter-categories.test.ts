import { describe, expect, it } from "vitest";
import { createSearchPerimeterCategoriesTool } from "../../../src/domain/perimeters/search-perimeter-categories.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-041 — search_perimeter_categories", () => {
  it("retorna categorias normalizadas", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 3, name: "Transporte", type: "C" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchPerimeterCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", type: "C" }), ctx);

    expect(result.data.categories).toEqual([{ id: 3, name: "Transporte", type: "C" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros (name, type, client_id) para os query params reais", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchPerimeterCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const input = definition.inputSchema.parse({
      central: "central-1",
      name_contains: "Trans",
      type: "P",
      client_id: 42,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/perimeters/categories",
        query: {
          "filters[name][inc]": "Trans",
          "filters[type]": "P",
          "filters[client_id]": 42,
          page: 1,
          perPage: 50,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma categoria corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchPerimeterCategoriesTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.categories).toEqual([]);
  });

  it("rejeita type fora do enum documentado (C=Geofence, P=Reference point)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchPerimeterCategoriesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", type: "X" })).toThrow();
  });
});
