import { describe, expect, it } from "vitest";
import { createSearchEquipmentCarriersTool } from "../../../src/domain/web-equipments/search-equipment-carriers.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-094 — search_equipment_carriers", () => {
  it("retorna operadoras normalizadas e paginadas, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ name: "VIVO", apn: "zap.vivo.com.br" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentCarriersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", name: "VIVO", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.carriers).toEqual([{ name: "VIVO", apn: "zap.vivo.com.br" }]);
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { "filters[name]": "VIVO", page: 1, per_page: 5 } }));
  });

  it("retorna lista vazia normalizada quando nenhuma operadora corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentCarriersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", name: "totalmente-inventado" }),
      ctx,
    );

    expect(result.data.carriers).toEqual([]);
  });
});
