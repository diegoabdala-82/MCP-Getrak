import { describe, expect, it } from "vitest";
import { createGetIdentifiersSummaryTool } from "../../../src/domain/journeys/get-identifiers-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-087 — get_identifiers_summary", () => {
  it("retorna o resumo normalizado (available/has_driver/total)", async () => {
    const fake = createFakeApiCoreClient({ data: { available: 101, has_driver: 134, total: 235 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetIdentifiersSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ available: 101, has_driver: 134, total: 235 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/journeys/identifiers/summary" }));
  });
});
