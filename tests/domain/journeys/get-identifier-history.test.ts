import { describe, expect, it } from "vitest";
import { createGetIdentifierHistoryTool } from "../../../src/domain/journeys/get-identifier-history.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-089 — get_identifier_history", () => {
  it("retorna o histórico normalizado e paginado para um driver_id válido", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ identifier_id: "00000000000000", driver_id: 380021, start_date: "2023-10-30 08:53:15", end_date: null }],
      page: 1,
      pages: 1,
      total: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetIdentifierHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", driver_id: 380021 }), ctx);

    expect(result.data.history).toEqual([
      { identifier_id: "00000000000000", driver_id: 380021, start_date: "2023-10-30 08:53:15", end_date: null },
    ]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v1.0/journeys/identifier-history", query: expect.objectContaining({ "filters[driver_id]": 380021 }) }),
    );
  });

  it("ACHADO CRÍTICO: driver_id é obrigatório no schema Zod (omiti-lo produziria HTTP 500 cru na API real)", () => {
    const { definition } = createGetIdentifierHistoryTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: createFakeDelegatedTokenManager().manager,
    });

    expect(() => definition.inputSchema.parse({ central: "central-1" })).toThrow();
  });

  it("retorna lista vazia normalizada quando o driver_id não tem histórico (não erro)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetIdentifierHistoryTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", driver_id: 999999999 }),
      ctx,
    );

    expect(result.data.history).toEqual([]);
  });
});
