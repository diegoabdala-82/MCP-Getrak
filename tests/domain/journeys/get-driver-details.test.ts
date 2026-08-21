import { describe, expect, it } from "vitest";
import { createGetDriverDetailsTool } from "../../../src/domain/journeys/get-driver-details.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-084 — get_driver_details", () => {
  it("retorna o motorista normalizado para um id válido", async () => {
    const fake = createFakeApiCoreClient({ data: { id: 364020, name: "....k", client_id: 1070786 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriverDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 364020 }), ctx);

    expect(result.data.driver).toEqual({ id: 364020, name: "....k", client_id: 1070786 });
    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ path: "/v2.0/journeys/drivers/364020" }));
  });

  it("ACHADO CRÍTICO: normaliza id inexistente (HTTP 204 sem corpo) para DRIVER_NOT_FOUND", async () => {
    // 204 é tratado na fundação (ApiCoreClient.get) retornando `undefined`
    // em vez de tentar fazer parse de um corpo vazio — simulado aqui
    // devolvendo `undefined` diretamente do fake client.
    const fake = createFakeApiCoreClient(undefined);
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriverDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await expect(
      definition.handler(definition.inputSchema.parse({ central: "central-1", id: 999999999 }), ctx),
    ).rejects.toMatchObject({ code: "DRIVER_NOT_FOUND", retryable: false });
  });

  it("envia include[] com os valores pedidos (client/identifier/vehicle)", async () => {
    const fake = createFakeApiCoreClient({ data: { id: 1 } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetDriverDetailsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    await definition.handler(
      definition.inputSchema.parse({ central: "central-1", id: 1, include: ["client", "vehicle"] }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { "include[]": ["client", "vehicle"] } }));
  });
});
