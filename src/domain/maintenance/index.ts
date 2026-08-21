/**
 * Epic 14 — Maintenance (US-051 a US-060). Ponto único de registro das 10
 * tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetFuelSupplyAttachmentsTool } from "./get-fuel-supply-attachments.js";
import { createGetFuelSupplyDetailsTool } from "./get-fuel-supply-details.js";
import { createGetFuelSupplySummaryTool } from "./get-fuel-supply-summary.js";
import { createGetMaintenanceAttachmentsTool } from "./get-maintenance-attachments.js";
import { createGetMaintenanceDetailsTool } from "./get-maintenance-details.js";
import { createGetMaintenanceServicesSummaryTool } from "./get-maintenance-services-summary.js";
import { createGetMaintenancesSummaryTool } from "./get-maintenances-summary.js";
import { createSearchFuelSuppliesTool } from "./search-fuel-supplies.js";
import { createSearchMaintenanceServicesTool } from "./search-maintenance-services.js";
import { createSearchMaintenancesTool } from "./search-maintenances.js";
import type { MaintenanceToolDeps } from "./shared.js";

export function registerMaintenanceTools(registerDomainTool: RegisterDomainTool, deps: MaintenanceToolDeps): void {
  registerDomainTool(createSearchFuelSuppliesTool(deps));
  registerDomainTool(createGetFuelSupplySummaryTool(deps));
  registerDomainTool(createGetFuelSupplyDetailsTool(deps));
  registerDomainTool(createGetFuelSupplyAttachmentsTool(deps));
  registerDomainTool(createSearchMaintenanceServicesTool(deps));
  registerDomainTool(createGetMaintenanceServicesSummaryTool(deps));
  registerDomainTool(createSearchMaintenancesTool(deps));
  registerDomainTool(createGetMaintenancesSummaryTool(deps));
  registerDomainTool(createGetMaintenanceDetailsTool(deps));
  registerDomainTool(createGetMaintenanceAttachmentsTool(deps));
}
