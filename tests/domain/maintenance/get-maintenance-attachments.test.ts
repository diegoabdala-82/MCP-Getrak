import { describe, expect, it } from "vitest";
import { createGetMaintenanceAttachmentsTool } from "../../../src/domain/maintenance/get-maintenance-attachments.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-060 — get_maintenance_attachments", () => {
  it("retorna os anexos normalizados de uma manutenção existente", async () => {
    const fake = createFakeApiCoreClient({ data: [{ id: 7, mime_type: "application/pdf", status: "completed" }] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenanceAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 1 }), ctx);

    expect(result.data.attachments).toEqual([{ id: 7, mime_type: "application/pdf", status: "completed" }]);
    expect(fake.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/v2.0/maintenance/maintenances/1/attachments", notFoundCode: "MAINTENANCE_NOT_FOUND" }),
    );
  });

  it("retorna lista vazia normalizada quando a manutenção não tem nenhum anexo", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createGetMaintenanceAttachmentsTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1", id: 1 }), ctx);

    expect(result.data.attachments).toEqual([]);
  });
});
