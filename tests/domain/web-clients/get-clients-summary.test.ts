import { describe, expect, it } from "vitest";
import { createGetClientsSummaryTool } from "../../../src/domain/web-clients/get-clients-summary.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-062 — get_clients_summary", () => {
  it("retorna o resumo agregado de clientes", async () => {
    const fake = createFakeApiCoreClient({ active: 1868, inactive: 146, suspended: 88, total: 2102 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetClientsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ active: 1868, inactive: 146, suspended: 88, total: 2102 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v1.0/clients/summary", query: {} }));
  });

  it("retorna contagens zeradas normalizadas quando não há nenhum cliente na central", async () => {
    const fake = createFakeApiCoreClient({ active: 0, inactive: 0, suspended: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetClientsSummaryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.summary).toEqual({ active: 0, inactive: 0, suspended: 0, total: 0 });
  });
});
