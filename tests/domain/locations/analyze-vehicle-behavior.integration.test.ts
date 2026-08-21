import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createAnalyzeVehicleBehaviorTool } from "../../../src/domain/locations/analyze-vehicle-behavior.js";
import { createFakeDelegatedApiCoreClient, createFakeDelegatedTokenManager, createRejectingApiCoreClient } from "./test-helpers.js";

describe("analyze_vehicle_behavior — integração via ToolRuntime", () => {
  it("bloqueia cross-central antes de chamar get_vehicle_last_registers", async () => {
    const fake = createFakeDelegatedApiCoreClient({ data: [], page: 1, totalItems: 0, itemsPerPage: 100, totalPages: 0, vehicle: null });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", vehicle_id: 6386345, date: "2026-08-07" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("bloqueia com VALIDATION_ERROR quando 'date' está ausente, antes de qualquer chamada", async () => {
    const fake = createFakeDelegatedApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", vehicle_id: 6386345 },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("bloqueia com VALIDATION_ERROR quando vehicle_id não é number (idêntico à US-106, ver conflito 1 documentado)", async () => {
    const fake = createFakeDelegatedApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", vehicle_id: "6386345", date: "2026-08-07" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza veículo inexistente para VEHICLE_NOT_FOUND via ToolRuntime, sem tentar calcular análise", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Vehicle was not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", vehicle_id: 999999999, date: "2026-08-07" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "VEHICLE_NOT_FOUND" } });
    expect(auditSink.records[0]).toMatchObject({ tool: "analyze_vehicle_behavior", result: "error", error_code: "VEHICLE_NOT_FOUND" });
  });

  it("caminho feliz completo via ToolRuntime, com envelope padrão (data/meta/warnings)", async () => {
    const fake = createFakeDelegatedApiCoreClient({
      data: [
        {
          vehicleId: 6386345,
          date: "2026-08-07T15:47:59.000-03:00",
          classification: 2,
          data: { datagps: "2026-08-07T15:47:59.000-03:00", velocidade: 42, ignicao: 1, tipo: "Normal" },
        },
      ],
      page: 1,
      totalItems: 1,
      itemsPerPage: 100,
      totalPages: 1,
      vehicle: { id: 6386345 },
    });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createAnalyzeVehicleBehaviorTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }));
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", vehicle_id: 6386345, date: "2026-08-07" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({
      data: {
        summary: [{ metric: "speed", min: 42, max: 42, avg: 42, count: 1 }],
        anomalies: [],
        alerts: [{ timestamp: "2026-08-07T15:47:59.000-03:00", state: "Normal" }],
        ignition_segments: [{ start: "2026-08-07T15:47:59.000-03:00", end: "2026-08-07T15:47:59.000-03:00", state: true }],
      },
      meta: { central: "central-1", partial: false },
      warnings: [],
    });
  });
});
