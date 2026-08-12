import { describe, expect, it } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../src/foundation/authorization/central-authorization.js";

describe("US-002 — isolamento obrigatório por central", () => {
  const provider = new StaticCentralAuthorizationProvider({
    "consumer-a": ["central-1", "central-2"],
  });
  const guard = new CentralAuthorizationGuard(provider);

  it("permite a chamada quando a central está entre as autorizadas do consumidor", async () => {
    await expect(
      guard.assertAuthorized({ consumer: { consumer_id: "consumer-a" }, central: "central-1" }),
    ).resolves.toBeUndefined();
  });

  it("bloqueia a chamada quando a central não está autorizada para o consumidor (cross-central)", async () => {
    const promise = guard.assertAuthorized({
      consumer: { consumer_id: "consumer-a" },
      central: "central-99",
    });

    await expect(promise).rejects.toBeInstanceOf(McpToolError);
    await promise.catch((err: McpToolError) => {
      expect(err.code).toBe(ErrorCodes.CENTRAL_NOT_AUTHORIZED);
      expect(err.retryable).toBe(false);
    });
  });

  it("bloqueia por padrão um consumidor sem nenhuma central configurada", async () => {
    await expect(
      guard.assertAuthorized({ consumer: { consumer_id: "consumer-desconhecido" }, central: "central-1" }),
    ).rejects.toMatchObject({ code: ErrorCodes.CENTRAL_NOT_AUTHORIZED });
  });
});
