/**
 * Epic 21 — Equipments, Getrak Web (US-090 a US-102). Ponto único de
 * registro das 13 tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetEquipmentImportItemsTool } from "./get-equipment-import-items.js";
import { createGetEquipmentImportSummaryTool } from "./get-equipment-import-summary.js";
import { createGetEquipmentTagDetailsTool } from "./get-equipment-tag-details.js";
import { createGetEquipmentsSummaryTool } from "./get-equipments-summary.js";
import { createGetInventorySummaryTool } from "./get-inventory-summary.js";
import { createGetWebEquipmentDetailsTool } from "./get-web-equipment-details.js";
import { createSearchDeviceModelsTool } from "./search-device-models.js";
import { createSearchEquipmentCarriersTool } from "./search-equipment-carriers.js";
import { createSearchEquipmentDevicesTool } from "./search-equipment-devices.js";
import { createSearchEquipmentImportRequestsTool } from "./search-equipment-import-requests.js";
import { createSearchEquipmentTagsTool } from "./search-equipment-tags.js";
import { createSearchInventoryTool } from "./search-inventory.js";
import { createSearchWebEquipmentsTool } from "./search-web-equipments.js";
import type { WebEquipmentsToolDeps } from "./shared.js";

export function registerWebEquipmentTools(registerDomainTool: RegisterDomainTool, deps: WebEquipmentsToolDeps): void {
  registerDomainTool(createSearchWebEquipmentsTool(deps));
  registerDomainTool(createGetWebEquipmentDetailsTool(deps));
  registerDomainTool(createSearchEquipmentDevicesTool(deps));
  registerDomainTool(createGetEquipmentsSummaryTool(deps));
  registerDomainTool(createSearchEquipmentCarriersTool(deps));
  registerDomainTool(createGetInventorySummaryTool(deps));
  registerDomainTool(createSearchInventoryTool(deps));
  registerDomainTool(createSearchEquipmentTagsTool(deps));
  registerDomainTool(createGetEquipmentTagDetailsTool(deps));
  registerDomainTool(createSearchDeviceModelsTool(deps));
  registerDomainTool(createSearchEquipmentImportRequestsTool(deps));
  registerDomainTool(createGetEquipmentImportItemsTool(deps));
  registerDomainTool(createGetEquipmentImportSummaryTool(deps));
}
