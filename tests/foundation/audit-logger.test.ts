import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../src/foundation/audit/audit-logger.js";
import { deepMask } from "../../src/foundation/audit/masking.js";

describe("US-005 — auditoria estruturada por chamada", () => {
  it("gera um registro com todos os campos exigidos para uma execução concluída", async () => {
    const sink = new InMemoryAuditSink();
    const logger = new AuditLogger(sink);

    await logger.record({
      request_id: "req-1",
      consumer_id: "consumer-a",
      environment: "homologation",
      central: "central-1",
      tool: "search_vehicles",
      endpoints: ["GET /v0.2/veiculos"],
      risk: "low",
      result: "success",
      duration_ms: 42,
      timestamp: "2026-08-12T00:00:00.000Z",
    });

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      request_id: "req-1",
      consumer_id: "consumer-a",
      environment: "homologation",
      central: "central-1",
      tool: "search_vehicles",
      result: "success",
      duration_ms: 42,
    });
  });

  it("mascara dados sensíveis conhecidos antes de gravar (tokens, CPF, telefone, e-mail)", async () => {
    const sink = new InMemoryAuditSink();
    const logger = new AuditLogger(sink);

    await logger.record({
      request_id: "req-2",
      consumer_id: "consumer-a",
      environment: "homologation",
      central: "central-1",
      tool: "get_customer_link",
      endpoints: [],
      risk: "medium",
      result: "success",
      duration_ms: 10,
      timestamp: "2026-08-12T00:00:00.000Z",
      details: {
        token: "abc.def.ghi",
        cpf: "123.456.789-00",
        email: "user@example.com",
        placa: "ABC1234",
        modelo: "Fiat Uno",
      },
    });

    expect(sink.records[0]?.details).toEqual({
      token: "[REDACTED]",
      cpf: "[REDACTED]",
      email: "[REDACTED]",
      placa: "[REDACTED]",
      modelo: "Fiat Uno",
    });
  });

  it("deepMask redige recursivamente campos sensíveis em estruturas aninhadas", () => {
    const masked = deepMask({
      user: { email: "a@b.com", name: "Diego" },
      credentials: [{ client_secret: "s3cr3t" }],
    });

    expect(masked).toEqual({
      user: { email: "[REDACTED]", name: "Diego" },
      credentials: [{ client_secret: "[REDACTED]" }],
    });
  });
});
