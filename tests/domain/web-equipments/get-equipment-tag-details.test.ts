import { describe, expect, it } from "vitest";
import { createGetEquipmentTagDetailsTool } from "../../../src/domain/web-equipments/get-equipment-tag-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-098 — get_equipment_tag_details", () => {
  it("retorna a tag normalizada para um id existente", async () => {
    const fake = createFakeApiCoreClient({ id: 27, value: "Jennifer" });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentTagDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 27 }), ctx);

    expect(result.data.tag).toEqual({ id: 27, value: "Jennifer" });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/equipments/tags/27", notFoundCode: "EQUIPMENT_TAG_NOT_FOUND" }));
  });
});
