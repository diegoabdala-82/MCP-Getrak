import { describe, expect, it } from "vitest";
import { createGetDriversSummaryTool } from "../../../src/domain/journeys/get-drivers-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-085 — get_drivers_summary", () => {
  it("retorna o resumo normalizado (has_vehicles/available/total)", async () => {
    const fake = createFakeApiCoreClient({ data: { has_vehicles: 55, available: 288, total: 343 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriversSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ has_vehicles: 55, available: 288, total: 343 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/journeys/drivers/summary" }));
  });
});
