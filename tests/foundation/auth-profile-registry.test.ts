import { describe, expect, it } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import { assertNoForbiddenAuthParams } from "../../src/foundation/auth/auth-profile-registry.js";

describe("US-047 — Auth Profile Registry (assertNoForbiddenAuthParams)", () => {
  it("não lança para um input normal de tool", () => {
    expect(() => assertNoForbiddenAuthParams({ central: "central-1", plate: "ABC1234" })).not.toThrow();
  });

  it.each(["scope", "auth_profile", "credential_id"])("rejeita tentativa de informar '%s' como parâmetro", (key) => {
    try {
      assertNoForbiddenAuthParams({ central: "central-1", [key]: "anything" });
      throw new Error("expected assertNoForbiddenAuthParams to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(McpToolError);
      expect((err as McpToolError).code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect((err as McpToolError).retryable).toBe(false);
    }
  });

  it("não lança para input não-objeto (undefined, null, array) — deixa a validação de schema tratar", () => {
    expect(() => assertNoForbiddenAuthParams(undefined)).not.toThrow();
    expect(() => assertNoForbiddenAuthParams(null)).not.toThrow();
    expect(() => assertNoForbiddenAuthParams(["scope"])).not.toThrow();
  });
});
