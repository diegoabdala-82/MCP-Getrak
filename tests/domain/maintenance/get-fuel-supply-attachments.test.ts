import { describe, expect, it } from "vitest";
import { createGetFuelSupplyAttachmentsTool } from "../../../src/domain/maintenance/get-fuel-supply-attachments.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-054 — get_fuel_supply_attachments", () => {
  it("retorna os anexos normalizados de um abastecimento existente", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 42, mime_type: "image/jpeg", status: "completed" }] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplyAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 101 }), ctx);

    expect(result.data.attachments).toEqual([{ id: 42, mime_type: "image/jpeg", status: "completed" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v2.0/maintenance/fuel-supply/101/attachments", notFoundCode: "FUEL_SUPPLY_NOT_FOUND" }),
    );
  });

  it("retorna lista vazia normalizada quando o abastecimento não tem nenhum anexo", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetFuelSupplyAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 101 }), ctx);

    expect(result.data.attachments).toEqual([]);
  });
});
