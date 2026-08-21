import { describe, expect, it } from "vitest";
import { createGetEquipmentsSummaryTool } from "../../../src/domain/web-equipments/get-equipments-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-093 — get_equipments_summary", () => {
  it("retorna o resumo agregado quando nenhum filtro é informado", async () => {
    const fake = createFakeApiCoreClient({ active: 15808, inactive: 2384, maintenance: 15, discarded: 3, total: 18219, lost: 9 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ active: 15808, inactive: 2384, maintenance: 15, discarded: 3, total: 18219, lost: 9 });
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("repassa model_id como filters[model_id][eq]", async () => {
    const fake = createFakeApiCoreClient({ active: 13, inactive: 30, maintenance: 2, discarded: 1, total: 50, lost: 4 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", model_id: 3 }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { "filters[model_id][eq]": 3 } }));
  });
});
