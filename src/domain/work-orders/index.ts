/**
 * Epic 5 — Ordens de Serviço (US-022 a US-025). Ponto único de registro das
 * 4 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetWorkOrderDetailsTool } from "./get-work-order-details.js";
import { createGetWorkOrderReportTool } from "./get-work-order-report.js";
import { createGetWorkOrderTestsTool } from "./get-work-order-tests.js";
import { createGetWorkOrderTestsDefinitionTool } from "./get-work-order-tests-definition.js";
import type { WorkOrdersToolDeps } from "./shared.js";

export function registerWorkOrderTools(registerDomainTool: RegisterDomainTool, deps: WorkOrdersToolDeps): void {
  registerDomainTool(createGetWorkOrderDetailsTool(deps));
  registerDomainTool(createGetWorkOrderTestsTool(deps));
  registerDomainTool(createGetWorkOrderTestsDefinitionTool(deps));
  registerDomainTool(createGetWorkOrderReportTool(deps));
}
