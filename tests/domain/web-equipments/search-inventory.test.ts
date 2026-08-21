import { describe, expect, it } from "vitest";
import { createSearchInventoryTool } from "../../../src/domain/web-equipments/search-inventory.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-096 — search_inventory", () => {
  it("retorna itens de inventário normalizados e paginados, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ model: { id: 3 }, current: 30, min: 5, max: 20 }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchInventoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", model_id: 3, sort_by: "current", sort_direction: "DESC", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.inventory).toEqual([{ model: { id: 3 }, current: 30, min: 5, max: 20 }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ "filters[model][eq]": 3, "order[current]": "DESC", page: 1, per_page: 5 }) }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum item de inventário corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchInventoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", search: "totalmente-inventado" }),
      ctx,
    );

    expect(result.data.inventory).toEqual([]);
  });
});
