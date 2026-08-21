/**
 * Epic 19 — Operations (US-079). Ponto único de registro da tool do
 * domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createSearchOperationsTool } from "./search-operations.js";
import type { OperationsToolDeps } from "./shared.js";

export function registerOperationTools(registerDomainTool: RegisterDomainTool, deps: OperationsToolDeps): void {
  registerDomainTool(createSearchOperationsTool(deps));
}
