import { describe, expect, it } from "vitest";
import { createGetAccessoriesSummaryTool } from "../../../src/domain/accessories/get-accessories-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-037 — get_accessories_summary", () => {
  it("retorna o resumo normalizado", async () => {
    const fake = createFakeApiCoreClient({ skus: 121, categories: 10 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAccessoriesSummaryTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ skus: 121, categories: 10 });
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("não envia nenhum query param (endpoint real não aceita nenhum)", async () => {
    const fake = createFakeApiCoreClient({ skus: 0, categories: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAccessoriesSummaryTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });
    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/accessories/summary", query: {} }),
    );
  });

  it("exige central", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetAccessoriesSummaryTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({})).toThrow();
  });
});
