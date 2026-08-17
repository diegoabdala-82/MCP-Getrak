import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { McpToolError } from "../../../src/domain/errors.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createGetVehicleByEquipmentTool } from "../../../src/domain/web-vehicles/get-vehicle-by-equipment.js";
import {
  createFakeApiCoreClient,
  createFakeDelegatedTokenManager,
  createRejectingApiCoreClient,
  createRejectingDelegatedTokenManager,
} from "./test-helpers.js";

describe("get_vehicle_by_equipment — integração completa via ToolRuntime", () => {
  it("aplica autenticação delegada/validação de central/envelope/auditoria sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient({ serial_number: "M352094084587374", vehicle: { id: 4085381, plate: "NYC1D62" } });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", serial_number: "M352094084587374" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ data: { link: { serial_number: "M352094084587374" } } });
    expect(auditSink.records[0]).toMatchObject({ tool: "get_vehicle_by_equipment", result: "success", auth_scheme: "delegated_user" });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient({});
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99", serial_number: "M352094084587374" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("normaliza serial_number sem veículo associado para VEHICLE_NOT_FOUND no envelope padrão", async () => {
    const fake = createRejectingApiCoreClient(
      new McpToolError({ code: "VEHICLE_NOT_FOUND", message: "Resource not found.", retryable: false }),
    );
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const auditSink = new InMemoryAuditSink();
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", serial_number: "NAO-EXISTE-999" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "VEHICLE_NOT_FOUND", retryable: false } });
    expect(auditSink.records[0]).toMatchObject({ result: "error", error_code: "VEHICLE_NOT_FOUND" });
  });

  it("normaliza falha de credencial delegada inválida (USER_CREDENTIAL_INVALID)", async () => {
    const fake = createFakeApiCoreClient({});
    const rejectingDelegated = createRejectingDelegatedTokenManager(
      new McpToolError({ code: "USER_CREDENTIAL_INVALID", message: "The stored user credential was rejected.", retryable: false }),
    );
    const { definition } = createGetVehicleByEquipmentTool({ apiCoreClient: fake.client, delegatedTokenManager: rejectingDelegated.manager });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", serial_number: "M352094084587374" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "USER_CREDENTIAL_INVALID", retryable: false } });
  });
});
