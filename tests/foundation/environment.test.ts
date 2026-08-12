import { describe, expect, it } from "vitest";
import { DEFAULT_ENVIRONMENT, isEnvironment, resolveEnvironment } from "../../src/config/environment.js";

describe("US-001 — resolução de ambiente", () => {
  it("usa homologation como padrão quando nenhum ambiente é configurado", () => {
    expect(resolveEnvironment({ env: {} })).toBe("homologation");
    expect(DEFAULT_ENVIRONMENT).toBe("homologation");
  });

  it("nunca usa production como padrão implícito", () => {
    expect(resolveEnvironment({ env: {} })).not.toBe("production");
  });

  it("resolve o ambiente explicitamente configurado no servidor", () => {
    expect(resolveEnvironment({ env: { GETRAK_MCP_ENVIRONMENT: "production" } })).toBe("production");
    expect(resolveEnvironment({ env: { GETRAK_MCP_ENVIRONMENT: "development" } })).toBe("development");
  });

  it("rejeita valores de ambiente desconhecidos", () => {
    expect(() => resolveEnvironment({ env: { GETRAK_MCP_ENVIRONMENT: "staging" } })).toThrow();
  });

  it("isEnvironment identifica corretamente valores válidos e inválidos", () => {
    expect(isEnvironment("development")).toBe(true);
    expect(isEnvironment("staging")).toBe(false);
  });
});
