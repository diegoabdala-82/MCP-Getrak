import { describe, expect, it } from "vitest";
import { createSearchDeviceModelsTool } from "../../../src/domain/web-equipments/search-device-models.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-099 — search_device_models", () => {
  it("retorna modelos normalizados e paginados, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 3, description: "ACP" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDeviceModelsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", description_contains: "ACP", page: 1, page_size: 5 }),
      ctx,
    );

    expect(result.data.device_models).toEqual([{ id: 3, description: "ACP" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ "filters[description][like]": "ACP", page: 1, per_page: 5 }) }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum modelo corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchDeviceModelsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", description_contains: "totalmente-inventado" }),
      ctx,
    );

    expect(result.data.device_models).toEqual([]);
  });
});
