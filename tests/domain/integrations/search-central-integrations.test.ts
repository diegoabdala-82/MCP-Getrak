import { describe, expect, it } from "vitest";
import { createSearchCentralIntegrationsTool } from "../../../src/domain/integrations/search-central-integrations.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-039 — search_central_integrations", () => {
  it("retorna integrações normalizadas dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 123, provider_id: 456, status: "active" }],
      page: 1,
      pages: 1,
      total: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchCentralIntegrationsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", status: "active" }), ctx);

    expect(result.data.integrations).toEqual([{ id: 123, provider_id: 456, status: "active" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/fields/include (comma-joined, explode=false) e paginação", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchCentralIntegrationsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });

    const input = definition.inputSchema.parse({
      central: "central-1",
      id: "123",
      provider_id: "456",
      status: "active",
      fields: ["id", "status", "credentials"],
      include_provider: true,
      sort_by: "created_at",
      sort_direction: "desc",
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/integrations",
        query: {
          "fields[]": "id,status,credentials",
          "include[]": "provider",
          "filters[id][eq]": "123",
          "filters[provider_id][eq]": "456",
          "filters[status][eq]": "active",
          "order[created_at]": "desc",
          page: 1,
          perPage: 50,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma integração corresponde", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchCentralIntegrationsTool({
      apiCoreClient: fake.client,
      delegatedTokenManager: delegated.manager,
    });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.integrations).toEqual([]);
  });

  it("rejeita status fora do enum documentado (active|error|inactive)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchCentralIntegrationsTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", status: "unknown" })).toThrow();
  });
});
