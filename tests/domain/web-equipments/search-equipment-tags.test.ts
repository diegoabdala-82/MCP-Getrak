import { describe, expect, it } from "vitest";
import { createSearchEquipmentTagsTool } from "../../../src/domain/web-equipments/search-equipment-tags.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-097 — search_equipment_tags", () => {
  it("corta a lista completa retornada pelo upstream no lado do MCP (endpoint real não pagina)", async () => {
    const fullList = Array.from({ length: 10 }, (_, i) => ({ id: i, value: `tag-${i}` }));
    const fake = createFakeApiCoreClient({ data: fullList });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentTagsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", page: 1, page_size: 3 }),
      ctx,
    );

    expect(result.data.tags).toEqual(fullList.slice(0, 3));
    expect(result.data.pagination).toMatchObject({ page: 1, page_size: 3, total_items: 10, has_more: true });
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("retorna lista vazia normalizada quando a central não tem nenhuma tag cadastrada", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentTagsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.tags).toEqual([]);
    expect(result.data.pagination.total_items).toBe(0);
  });
});
