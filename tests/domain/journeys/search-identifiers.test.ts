import { describe, expect, it } from "vitest";
import { createSearchIdentifiersTool } from "../../../src/domain/journeys/search-identifiers.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-086 — search_identifiers", () => {
  it("retorna identificadores normalizados e paginados", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: "00000000000000", status: "N" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchIdentifiersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.identifiers).toEqual([{ id: "00000000000000", status: "N" }]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/journeys/identifiers" }));
  });

  it("traduz filtros/paginação para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchIdentifiersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      search: "Suntech",
      has_driver: true,
      sort_by: "manufacturer",
      sort_direction: "ASC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          "filters[search]": "Suntech",
          "filters[has_driver]": true,
          "order[manufacturer]": "ASC",
          page: 2,
          per_page: 10,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum identificador corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchIdentifiersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "inexistente" }),
      ctx,
    );

    expect(result.data.identifiers).toEqual([]);
  });
});
