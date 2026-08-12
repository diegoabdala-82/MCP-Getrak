import { describe, expect, it } from "vitest";
import { ErrorCodes, McpToolError } from "../../src/domain/errors.js";
import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
  normalizeNullable,
  normalizeNullableFields,
} from "../../src/foundation/envelope/response-envelope.js";

describe("US-003 — normalização de respostas das tools", () => {
  it("produz uma estrutura de sucesso estável e previsível", () => {
    const envelope = buildSuccessEnvelope({
      data: { id: "v1" },
      requestId: "req-1",
      central: "central-1",
    });

    expect(envelope).toEqual({
      data: { id: "v1" },
      meta: { request_id: "req-1", central: "central-1", partial: false },
      warnings: [],
    });
  });

  it("sinaliza meta.partial em respostas parciais de tools compostas", () => {
    const envelope = buildSuccessEnvelope({
      data: {},
      requestId: "req-1",
      central: "central-1",
      partial: true,
      warnings: ["equipment lookup unavailable"],
    });

    expect(envelope.meta.partial).toBe(true);
    expect(envelope.warnings).toEqual(["equipment lookup unavailable"]);
  });

  it("produz o envelope de erro padronizado", () => {
    const error = new McpToolError({
      code: ErrorCodes.NOT_FOUND,
      message: "Vehicle not found.",
      retryable: false,
    });

    expect(buildErrorEnvelope(error, "req-2")).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Vehicle not found.",
        retryable: false,
        request_id: "req-2",
      },
    });
  });

  it("normaliza valor ausente (undefined) do endpoint de origem para null de forma consistente", () => {
    expect(normalizeNullable(undefined)).toBeNull();
    expect(normalizeNullable(null)).toBeNull();
    expect(normalizeNullable(0)).toBe(0);
    expect(normalizeNullable("")).toBe("");
  });

  it("normaliza campos ausentes de um objeto plano de forma consistente", () => {
    const raw = { placa: "ABC1234", modelo: undefined, ano: null };
    expect(normalizeNullableFields(raw)).toEqual({ placa: "ABC1234", modelo: null, ano: null });
  });
});
