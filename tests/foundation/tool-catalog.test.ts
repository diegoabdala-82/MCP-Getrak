import { describe, expect, it } from "vitest";
import {
  AllowAllToolPermissionChecker,
  ToolCatalog,
  type ToolCatalogEntry,
  type ToolPermissionChecker,
} from "../../src/foundation/catalog/tool-catalog.js";

function entry(overrides: Partial<ToolCatalogEntry> = {}): ToolCatalogEntry {
  return {
    name: "search_vehicles",
    description: "Search vehicles by identifier, plate or filters.",
    intent: "read",
    domain: "vehicles",
    risk: "low",
    environments: "all",
    version: "1.0.0",
    ...overrides,
  };
}

describe("US-007 — descoberta de tools via protocolo MCP e catálogo por domínio", () => {
  it("organiza o catálogo por domínio", () => {
    const catalog = new ToolCatalog();
    catalog.register(entry({ name: "search_vehicles", domain: "vehicles" }));
    catalog.register(entry({ name: "get_last_known_location", domain: "locations" }));

    expect(catalog.getByDomain("vehicles").map((e) => e.name)).toEqual(["search_vehicles"]);
    expect(catalog.getByDomain("locations").map((e) => e.name)).toEqual(["get_last_known_location"]);
  });

  it("retorna apenas tools autorizadas na descoberta para o consumidor", async () => {
    const catalog = new ToolCatalog();
    catalog.register(entry({ name: "search_vehicles" }));
    catalog.register(entry({ name: "suspend_vehicle", intent: "write", risk: "high" }));

    const permissionChecker: ToolPermissionChecker = {
      isAuthorized: async (_consumerId, toolName) => toolName !== "suspend_vehicle",
    };

    const visible = await catalog.listForConsumer("consumer-a", permissionChecker);
    expect(visible.map((e) => e.name)).toEqual(["search_vehicles"]);
  });

  it("o checker padrão (piloto de consumidor único) autoriza todas as tools registradas", async () => {
    const catalog = new ToolCatalog();
    catalog.register(entry({ name: "search_vehicles" }));
    catalog.register(entry({ name: "get_last_known_location", domain: "locations" }));

    const visible = await catalog.listForConsumer("consumer-a", new AllowAllToolPermissionChecker());
    expect(visible).toHaveLength(2);
  });

  it("impede registrar a mesma tool duas vezes", () => {
    const catalog = new ToolCatalog();
    catalog.register(entry({ name: "search_vehicles" }));
    expect(() => catalog.register(entry({ name: "search_vehicles" }))).toThrow();
  });
});
