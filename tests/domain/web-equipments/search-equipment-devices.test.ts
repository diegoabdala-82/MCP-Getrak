import { describe, expect, it } from "vitest";
import { createSearchEquipmentDevicesTool } from "../../../src/domain/web-equipments/search-equipment-devices.js";
import { createFakeApiCoreClient, createFakeDelegatedTokenManager, ctx } from "./test-helpers.js";

describe("US-092 — search_equipment_devices", () => {
  it("corta a lista completa retornada pelo upstream no lado do MCP (endpoint real não pagina)", async () => {
    const fullList = Array.from({ length: 30 }, (_, i) => ({ serial_number: `S${i}` }));
    const fake = createFakeApiCoreClient({ data: fullList });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentDevicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", page: 2, page_size: 10 }),
      ctx,
    );

    expect(result.data.devices).toEqual(fullList.slice(10, 20));
    expect(result.data.pagination).toMatchObject({ page: 2, page_size: 10, total_items: 30, has_more: true });
  });

  it("filtra por full_device_number e não emite o warning de dataset completo quando informado", async () => {
    const fake = createFakeApiCoreClient({ data: [{ serial_number: "S1", device_number: "011223" }] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentDevicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", full_device_number: "011223" }),
      ctx,
    );

    expect(fake.get).toHaveBeenCalledWith(expect.objectContaining({ query: { "filters[full_device_number]": "011223", "filters[status]": undefined } }));
    expect(result.warnings).toEqual([]);
  });

  it("emite warning sobre o dataset completo quando nenhum filtro exato é informado", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentDevicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(definition.inputSchema.parse({ central: "central-1" }), ctx);

    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("retorna lista vazia normalizada quando o filtro exato não encontra nenhum dispositivo", async () => {
    const fake = createFakeApiCoreClient({ data: [] });
    const delegated = createFakeDelegatedTokenManager();
    const { definition } = createSearchEquipmentDevicesTool({ apiCoreClient: fake.client, delegatedTokenManager: delegated.manager });

    const result = await definition.handler(
      definition.inputSchema.parse({ central: "central-1", full_device_number: "totally-fake" }),
      ctx,
    );

    expect(result.data.devices).toEqual([]);
    expect(result.data.pagination.total_items).toBe(0);
  });
});
