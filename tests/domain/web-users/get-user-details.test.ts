import { describe, expect, it } from "vitest";
import { createGetUserDetailsTool } from "../../../src/domain/web-users/get-user-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient, ctx } from "./test-helpers.js";
import { McpToolError } from "../../../src/domain/errors.js";

describe("US-067 — get_user_details", () => {
  it("retorna os dados normalizados de um usuário válido dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient({ id: 6603263, full_name: "Ygor", client: null, subclient: null, central: {} });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", user_id: 6603263 }),
      ctx,
    );

    expect(result.data.user).toEqual({ id: 6603263, full_name: "Ygor", client: null, subclient: null, central: {} });
    expect(result.authScheme).toBe("oauth2Password");
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1.0/users/6603263",
        query: { "fields[]": ["id", "fullName", "site", "clientId"] },
      }),
    );
  });

  it("normaliza um cliente associado, sem mascarar dados sensíveis (telefone/documento) na resposta ao consumidor autorizado", async () => {
    const fake = createFakeApiCoreClient({
      id: 5275760,
      site: "central-1",
      client_id: 1852555,
      full_name: "admnexcorp",
      client: {
        id: 1852555,
        name: "kesler",
        central: "central-1",
        status: "INACTIVE",
        business_phone: "",
        mobile_phone: "",
        document: "076.620.556-80",
      },
      subclient: null,
      central: {},
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", user_id: 5275760 }),
      ctx,
    );

    expect((result.data.user as { client: { document: string } }).client.document).toBe("076.620.556-80");
  });

  it("retorna erro USER_NOT_FOUND para um id de usuário inexistente", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "USER_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", user_id: 999999999 }), ctx),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("rejeita user_id inválido (não positivo)", () => {
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetUserDetailsTool({
      apiCoreClient: createFakeApiCoreClient({}).client,
      delegatedTokenManager: delegated.manager,
    });
    expect(() => definition.inputSchema.parse({ central: "central-1", user_id: -1 })).toThrow();
    expect(() => definition.inputSchema.parse({ central: "central-1" })).toThrow();
  });
});
