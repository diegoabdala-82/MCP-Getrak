import { describe, expect, it } from "vitest";
import { createGetEquipmentImportItemsTool } from "../../../src/domain/web-equipments/get-equipment-import-items.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-101 — get_equipment_import_items", () => {
  it("retorna os itens normalizados e paginados de uma requisição de importação existente", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 4205, file_line: 4, serial_number: "JE1" }], page: 1, pages: 1, total: 2 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentImportItemsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", id: 126, status: "failure" }),
      ctx,
    );

    expect(result.data.items).toEqual([{ id: 4205, file_line: 4, serial_number: "JE1" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/equipments/files/126/items", notFoundCode: "EQUIPMENT_IMPORT_NOT_FOUND" }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum item corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetEquipmentImportItemsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", id: 126, search: "totalmente-inventado" }),
      ctx,
    );

    expect(result.data.items).toEqual([]);
  });
});
