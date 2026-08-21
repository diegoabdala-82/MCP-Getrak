import { describe, expect, it } from "vitest";
import { createSearchWebUsersTool } from "../../../src/domain/web-users/search-web-users.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-068 — search_web_users", () => {
  it("retorna usuários normalizados e paginados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 1, full_name: "Cristiano" }], page: 1, pages: 1, total: 1 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", full_name_contains: "Cristiano" }),
      ctx,
    );

    expect(result.data.users).toEqual([{ id: 1, full_name: "Cristiano" }]);
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("traduz filtros/paginação/ordenação (incluindo o nome real 'updatad_at') para a query real, com per_page (não perPage)", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 1, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const input = definition.inputSchema.parse({
      central: "central-1",
      full_name_contains: "teste",
      username_contains: "adm",
      type: "admin",
      is_active: "Y",
      profile_id: 3,
      sort_by: "updatad_at",
      sort_direction: "DESC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.1/users",
        query: {
          "filters[full_name][inc]": "teste",
          "filters[username][inc]": "adm",
          "filters[type]": "admin",
          "filters[is_active]": "Y",
          "filters[profile_id]": 3,
          "order[updatad_at]": "DESC",
          page: 2,
          per_page: 10,
        },
        authScheme: "oauth2Password",
      }),
    );
  });

  it("retorna lista vazia normalizada quando nenhum usuário corresponde ao filtro", async () => {
    const fake = createFakeApiCoreClient({ data: [], page: 1, pages: 0, total: 0 });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", full_name_contains: "xyzxyzxyznaoexiste123" }),
      ctx,
    );

    expect(result.data.users).toEqual([]);
    expect(result.data.pagination).toMatchObject({ total_items: 0 });
  });

  it("rejeita type fora do enum documentado", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchWebUsersTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", type: "superadmin" })).toThrow();
  });
});
