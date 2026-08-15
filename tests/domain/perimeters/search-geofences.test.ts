import { describe, expect, it } from "vitest";
import { createSearchGeofencesTool } from "../../../src/domain/perimeters/search-geofences.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-040 — search_geofences", () => {
  it("retorna geofences normalizadas dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, name: "Filial SP" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchGeofencesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", name_contains: "Filial" }), ctx);

    expect(result.data.geofences).toEqual([{ id: 1, name: "Filial SP" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz fields[]/include[] (repetidos, explode=true) e filtros/paginação", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchGeofencesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      fields: ["id", "name", "is_active"],
      include_category: true,
      name: "Filial SP",
      is_active: "Y",
      sort_by: "name",
      sort_direction: "ASC",
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/perimeters/geofences",
        query: {
          "fields[]": ["id", "name", "is_active"],
          "include[]": "category",
          "filters[name]": "Filial SP",
          "filters[is_active]": "Y",
          "order[name]": "ASC",
          page: 1,
          perPage: 50,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma geofence corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchGeofencesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.geofences).toEqual([]);
  });

  it("rejeita is_active fora do enum documentado (Y/N)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchGeofencesTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", is_active: "X" })).toThrow();
  });
});
