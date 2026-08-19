import { describe, expect, it } from "vitest";
import { createSearchOperationsTool } from "../../../src/domain/operations/search-operations.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-079 — search_operations", () => {
  it("retorna operações normalizadas e paginadas quando os 3 filtros obrigatórios são informados", async () => {
    const fake = createFakeApiCoreClient({
      data: [{ id: 1, type: "device", operation: "I", primary: "12927131" }],
      page: 1,
      pages: 1,
      total: 1,
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchOperationsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        operation_types: ["device"],
        entity_id: "12927131",
        date: "2026-08-17",
      }),
      ctx,
    );

    expect(result.data.operations).toEqual([{ id: 1, type: "device", operation: "I", primary: "12927131" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz os filtros obrigatórios e a paginação para a query real, com per_page (não perPage) e [] no filtro de tipos", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchOperationsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      operation_types: ["device", "equipment_discarded"],
      entity_id: "12927131",
      date: "2026-08-17",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/operations",
        query: {
          "filters[operation_type][in][]": ["device", "equipment_discarded"],
          "filters[entity_id]": "12927131",
          "filters[date]": "2026-08-17",
          page: 2,
          per_page: 10,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhuma operação corresponde aos filtros", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchOperationsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({
        central: "central-1",
        operation_types: ["device"],
        entity_id: "99999999",
        date: "2026-08-17",
      }),
      ctx,
    );

    expect(result.data.operations).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });

  it("rejeita a ausência de qualquer um dos 3 filtros obrigatórios (validação antes de chamar a API Core)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchOperationsTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });

    expect(() =>
      definition.inputSchema.parse({ central: "central-1", entity_id: "1", date: "2026-08-17" }),
    ).toThrow();
    expect(() =>
      definition.inputSchema.parse({ central: "central-1", operation_types: ["device"], date: "2026-08-17" }),
    ).toThrow();
    expect(() =>
      definition.inputSchema.parse({ central: "central-1", operation_types: ["device"], entity_id: "1" }),
    ).toThrow();
    expect(() =>
      definition.inputSchema.parse({
        central: "central-1",
        operation_types: [],
        entity_id: "1",
        date: "2026-08-17",
      }),
    ).toThrow();
  });

  it("rejeita data fora do formato YYYY-MM-DD", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchOperationsTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });

    expect(() =>
      definition.inputSchema.parse({
        central: "central-1",
        operation_types: ["device"],
        entity_id: "1",
        date: "17/08/2026",
      }),
    ).toThrow();
  });
});
