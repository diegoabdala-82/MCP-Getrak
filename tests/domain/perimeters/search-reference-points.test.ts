import { describe, expect, it } from "vitest";
import { createSearchReferencePointsTool } from "../../../src/domain/perimeters/search-reference-points.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-042 — search_reference_points", () => {
  it("retorna pontos de referência normalizados", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, name: "Matriz" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReferencePointsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", name: "Matriz" }), ctx);

    expect(result.data.reference_points).toEqual([{ id: 1, name: "Matriz" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz fields[]/include[] (repetidos) e filtros/paginação", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReferencePointsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const input = definition.inputSchema.parse({
      central: "central-1",
      fields: ["id", "name", "latitude", "longitude"],
      include_category: true,
      name_contains: "Matriz",
      is_active: "Y",
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/perimeters/reference-points",
        query: {
          "fields[]": ["id", "name", "latitude", "longitude"],
          "include[]": "category",
          "filters[name][inc]": "Matriz",
          "filters[is_active]": "Y",
          page: 1,
          perPage: 50,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum ponto corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchReferencePointsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.reference_points).toEqual([]);
  });
});
