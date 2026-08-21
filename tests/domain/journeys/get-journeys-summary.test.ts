import { describe, expect, it } from "vitest";
import { createGetJourneysSummaryTool } from "../../../src/domain/journeys/get-journeys-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-082 — get_journeys_summary", () => {
  it("retorna o resumo normalizado (open/closed/total)", async () => {
    const fake = createFakeApiCoreClient({ data: { open: 38, closed: 497, total: 535 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetJourneysSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ open: 38, closed: 497, total: 535 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/journeys/summary" }));
  });
});
