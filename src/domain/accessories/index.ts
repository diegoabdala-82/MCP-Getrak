/**
 * Epic 10 — Accessories (US-035, US-036, US-037). Ponto único de registro
 * das 3 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetAccessoriesSummaryTool } from "./get-accessories-summary.js";
import { createSearchAccessoriesTool } from "./search-accessories.js";
import { createSearchAccessoryCategoriesTool } from "./search-accessory-categories.js";
import type { AccessoriesToolDeps } from "./shared.js";

export function registerAccessoryTools(registerDomainTool: RegisterDomainTool, deps: AccessoriesToolDeps): void {
  registerDomainTool(createSearchAccessoriesTool(deps));
  registerDomainTool(createSearchAccessoryCategoriesTool(deps));
  registerDomainTool(createGetAccessoriesSummaryTool(deps));
}
