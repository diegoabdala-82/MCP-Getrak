import { describe, expect, it } from "vitest";
import { createGetSubclientsSummaryTool } from "../../../src/domain/web-clients/get-subclients-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-063 — get_subclients_summary", () => {
  it("retorna o resumo agregado de subclientes", async () => {
    const fake = createFakeApiCoreClient({ active: 2032, inactive: 80, suspended: 32, total: 2144 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetSubclientsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ active: 2032, inactive: 80, suspended: 32, total: 2144 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/clients/subclients/summary", query: {} }));
  });

  it("retorna contagens zeradas normalizadas quando não há nenhum subcliente na central", async () => {
    const fake = createFakeApiCoreClient({ active: 0, inactive: 0, suspended: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetSubclientsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ active: 0, inactive: 0, suspended: 0, total: 0 });
  });
});
