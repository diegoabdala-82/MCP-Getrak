import { describe, expect, it } from "vitest";
import { createGetFuelSupplyDetailsTool } from "../../../src/domain/maintenance/get-fuel-supply-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-053 — get_fuel_supply_details", () => {
  it("retorna o abastecimento normalizado para um id existente", async () => {
    const fake = createFakeApiCoreClient({ id: 101, vehicle_id: 9910097, fuel_type: "gasoline" });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplyDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 101 }), ctx);

    expect(result.data.fuel_supply).toEqual({ id: 101, vehicle_id: 9910097, fuel_type: "gasoline" });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v2.0/maintenance/fuel-supply/101", notFoundCode: "FUEL_SUPPLY_NOT_FOUND" }),
    );
  });
});
