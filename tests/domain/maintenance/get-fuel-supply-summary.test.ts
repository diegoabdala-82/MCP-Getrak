import { describe, expect, it } from "vitest";
import { createGetFuelSupplySummaryTool } from "../../../src/domain/maintenance/get-fuel-supply-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-052 — get_fuel_supply_summary", () => {
  it("retorna o resumo agregado quando nenhum filtro é informado", async () => {
    const fake = createFakeApiCoreClient({
      total_cost: 43067.97,
      avg_price_per_unit: 6.86084,
      cost_per_km: null,
      consumption: null,
      metadata: { available_fuel_types: ["gasoline", "diesel"] },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplySummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toMatchObject({ total_cost: 43067.97 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2.0/maintenance/fuel-supply/summary", notFoundCode: "VEHICLE_NOT_FOUND" }));
  });

  it("repassa vehicle_id como filters[vehicle_id]", async () => {
    const fake = createFakeApiCoreClient({ total_cost: 408, avg_price_per_unit: 34, cost_per_km: null, consumption: null, metadata: {} });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplySummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", vehicle_id: 9910097 }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ "filters[vehicle_id]": 9910097 }) }));
  });
});
