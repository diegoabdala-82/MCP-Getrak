import { describe, expect, it } from "vitest";
import { createGetWebEquipmentDetailsTool } from "../../../src/domain/web-equipments/get-web-equipment-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-091 — get_web_equipment_details", () => {
  it("retorna o equipamento normalizado para um serial existente", async () => {
    const fake = createFakeApiCoreClient({ serial_number: "B123", status: "N", model: { id: 3 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetWebEquipmentDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", serial_number: "B123" }),
      ctx,
    );

    expect(result.data.equipment).toEqual({ serial_number: "B123", status: "N", model: { id: 3 } });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/equipments/B123", notFoundCode: "EQUIPMENT_NOT_FOUND" }));
  });

  it("faz URL-encode do serial_number no path", async () => {
    const fake = createFakeApiCoreClient({ serial_number: "B/123" });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetWebEquipmentDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1", serial_number: "B/123" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/equipments/B%2F123" }));
  });
});
