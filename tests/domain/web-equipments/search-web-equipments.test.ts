import { describe, expect, it } from "vitest";
import { createSearchWebEquipmentsTool } from "../../../src/domain/web-equipments/search-web-equipments.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-090 — search_web_equipments", () => {
  it("retorna equipamentos normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ serial_number: "B123", status: "Y" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebEquipmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", statuses: ["Y"] }),
      ctx,
    );

    expect(result.data.equipments).toEqual([{ serial_number: "B123", status: "Y" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros [in] como lista separada por vírgula e usa per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebEquipmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      statuses: ["L", "D"],
      model_ids: [1, 2],
      technologies: ["2G", "4G"],
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/equipments",
        query: expect.objectContaining({
          "filters[status][in]": "L,D",
          "filters[model_id][in]": "1,2",
          "filters[technology][in]": "2G,4G",
          page: 2,
          per_page: 10,
        }),
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum equipamento corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebEquipmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", serial_number: "NOPE99999999" }),
      ctx,
    );

    expect(result.data.equipments).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });
});
