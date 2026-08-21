import { describe, expect, it } from "vitest";
import { createGetInventorySummaryTool } from "../../../src/domain/web-equipments/get-inventory-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-095 — get_inventory_summary", () => {
  it("retorna o resumo de inventário agregado", async () => {
    const fake = createFakeApiCoreClient({ equipments: 2384, accessories: 13, sim_cards: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetInventorySummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ equipments: 2384, accessories: 13, sim_cards: 0 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/equipments/inventory-summary", query: {} }));
  });

  it("retorna contagens zeradas normalizadas quando não há nenhum item em estoque", async () => {
    const fake = createFakeApiCoreClient({ equipments: 0, accessories: 0, sim_cards: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetInventorySummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ equipments: 0, accessories: 0, sim_cards: 0 });
  });
});
