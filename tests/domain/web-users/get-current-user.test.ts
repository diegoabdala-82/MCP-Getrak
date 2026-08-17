import { describe, expect, it } from "vitest";
import { createGetCurrentUserTool, getCurrentUserInputSchema } from "../../../src/domain/web-users/get-current-user.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

const REAL_RESPONSE = {
  id: 6603263,
  login: "ygor-admin",
  nome: "Ygor",
  sistema: "central-1",
  centralId: 12101,
  email: "",
  timezone: "America/Sao_Paulo",
  permissao: [1, 2, 6, 28],
  perfil: 0,
  ativo: "Y",
  senhatemp: "N",
  tipo: 1,
  uid: "2C7D41CE857AA4A05D2CAD0F043A42EFF081F1E55A01F964DA48CA14B62A4FD7",
  acessoWs: "N",
};

describe("US-069 — get_current_user", () => {
  it("não recebe nenhum parâmetro de negócio — apenas central", () => {
    expect(Object.keys(getCurrentUserInputSchema.shape)).toEqual(["central"]);
  });

  it("retorna os dados do usuário autenticado, incluindo tipo/perfil (candidatos ao papel do Epic 10)", async () => {
    const fake = createFakeApiCoreClient(REAL_RESPONSE);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.user).toMatchObject({
      id: 6603263,
      login: "ygor-admin",
      nome: "Ygor",
      sistema: "central-1",
      centralId: 12101,
      tipo: 1,
      perfil: 0,
      ativo: "Y",
      acessoWs: "N",
    });
    expect(result.authScheme).toBe("oauth2Password");
  });

  it("omite o campo uid (identificador sensível tipo token) da resposta normalizada", async () => {
    const fake = createFakeApiCoreClient(REAL_RESPONSE);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.data.user).not.toHaveProperty("uid");
  });

  it("não envia nenhum parâmetro de negócio na query ao endpoint upstream", async () => {
    const fake = createFakeApiCoreClient(REAL_RESPONSE);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetCurrentUserTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/oauth/usuario", query: {} }));
  });
});
