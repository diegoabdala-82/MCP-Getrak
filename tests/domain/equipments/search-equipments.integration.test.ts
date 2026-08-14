import { describe, expect, it } from "vitest";
import { AuditLogger, InMemoryAuditSink } from "../../../src/foundation/audit/audit-logger.js";
import {
  CentralAuthorizationGuard,
  StaticCentralAuthorizationProvider,
} from "../../../src/foundation/authorization/central-authorization.js";
import { ToolRuntime } from "../../../src/foundation/tool-runtime.js";
import { createSearchEquipmentsTool } from "../../../src/domain/equipments/search-equipments.js";
import { createFakeApiCoreClient } from "./test-helpers.js";

describe("search_equipments — integração completa via ToolRuntime", () => {
  it("aplica autenticação/validação de central/envelope/auditoria da fundação sem duplicar lógica na tool", async () => {
    const fake = createFakeApiCoreClient([{ equipamento: "EQP1", modulo: "M1" }]);
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: fake.client });

    const auditSink = new InMemoryAuditSink();
    const centralGuard = new CentralAuthorizationGuard(
      new StaticCentralAuthorizationProvider({ "consumer-a": ["central-1"] }),
    );
    const runtime = new ToolRuntime(centralGuard, new AuditLogger(auditSink));

    const envelope = await runtime.execute(
      definition,
      { central: "central-1", module: "M1" },
      { consumer: { consumer_id: "consumer-a" }, environment: "homologation" },
    );

    expect(envelope).toMatchObject({
      data: { equipments: [{ equipamento: "EQP1", modulo: "M1" }] },
      meta: { central: "central-1", partial: false },
    });
    expect(auditSink.records[0]).toMatchObject({ tool: "search_equipments", result: "success" });
  });

  it("bloqueia cross-central antes de chamar a API Core", async () => {
    const fake = createFakeApiCoreClient([]);
    const { definition } = createSearchEquipmentsTool({ apiCoreClient: fake.client });

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
