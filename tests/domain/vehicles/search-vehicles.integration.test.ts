import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createSearchVehiclesTool } from "../../../src/domain/vehicles/search-vehicles.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

describe("search_vehicles — integração completa via ToolRuntime", () => {
  it("aplica autenticação/validação de central/envelope/auditoria da fundação sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient([{ id: 1, placa: "ABC1234" }]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    const auditSink = new InMemoryAuditSink();
    const auditLogger = new AuditLogger(auditSink);
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, auditLogger);

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", plate: "ABC1234" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({
      data: { vehicles: [{ id: 1, placa: "ABC1234" }] },
      meta: { central: "central-1", partial: false },
    });
    expect(auditSink.records).toHaveLength(1);
    expect(auditSink.records[0]).toMatchObject({ tool: "search_vehicles", result: "success", central: "central-1" });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchVehiclesTool({ apiCoreClient: fake.client });

    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(new InMemoryAuditSink()));

    const envelope = await runtime.execute(
      definition,
      { central: "central-99" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({ error: { code: "CENTRAL_NOT_AUTHORIZED" } });
    expect(fake.get).not.toHaveBeenCalled();
  });
});
