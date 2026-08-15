import { describe, expect, it } from "vitest";
import { createGetUserProfilesTool } from "../../../src/domain/accounts/get-user-profiles.js";
import { createFakeApiCoreClient, ctx } from "./test-helpers.js";

describe("US-033 — get_user_profiles", () => {
  it("retorna perfis normalizados dentro da central autorizada", async () => {
    const fake = createFakeApiCoreClient([{ id: 1234, nome: "getrakoperator", tipo: 2 }]);
    const { definition } = createGetUserProfilesTool({ apiCoreClient: fake.client });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.profiles).toEqual([{ id: 1234, nome: "getrakoperator", tipo: 2 }]);
    expect(result.endpoints).toEqual(["GET /v0.2/perfis/integracao"]);
  });

  it("envia central como sistema, e paginação como 'limite' (não 'limit')", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetUserProfilesTool({ apiCoreClient: fake.client });

    const input = definition.inputSchema.parse({
      central: "central-1",
      sort: "id ASC",
      page: 2,
      page_size: 10,
    });
    await definition.handler(input, ctx);

    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v0.2/perfis/integracao",
        query: {
          sistema: "central-1",
          ordem: "id ASC",
          limite: 10,
          offset: 10,
        },
        central: "central-1",
        authScheme: "oauth2ClientCredentials",
      }),
    );
  });

  it("retorna lista vazia normalizada (não erro) quando nenhum perfil corresponde", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createGetUserProfilesTool({ apiCoreClient: fake.client });
    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);
    expect(result.data.profiles).toEqual([]);
  });

  it("exige central", () => {
    const { definition } = createGetUserProfilesTool({ apiCoreClient: createFakeApiCoreClient([]).client });
    expect(() => definition.inputSchema.parse({})).toThrow();
  });
});
