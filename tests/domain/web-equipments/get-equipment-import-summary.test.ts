import { describe, expect, it } from "vitest";
import { createGetEquipmentImportSummaryTool } from "../../../src/domain/web-equipments/get-equipment-import-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-102 — get_equipment_import_summary", () => {
  it("retorna o resumo agregado de uma requisição de importação existente", async () => {
    const fake = createFakeApiCoreClient({ total: 4, failures: 2, success: 2 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentImportSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 126 }), ctx);

    expect(result.data.summary).toEqual({ total: 4, failures: 2, success: 2 });
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/equipments/files/126/summary", notFoundCode: "EQUIPMENT_IMPORT_NOT_FOUND" }),
    );
  });
});
