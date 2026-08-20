import type { RegisterDomainTool } from "../../server.js";
import { createGetAvailableVehiclesForJourneyTool } from "./get-available-vehicles-for-journey.js";
import { createGetDriverDetailsTool } from "./get-driver-details.js";
import { createGetDriversSummaryTool } from "./get-drivers-summary.js";
import { createGetIdentifierHistoryTool } from "./get-identifier-history.js";
import { createGetIdentifiersSummaryTool } from "./get-identifiers-summary.js";
import { createGetJourneyDetailsTool } from "./get-journey-details.js";
import { createGetJourneysSummaryTool } from "./get-journeys-summary.js";
import { createSearchDriversTool } from "./search-drivers.js";
import { createSearchIdentifiersTool } from "./search-identifiers.js";
import { createSearchJourneysTool } from "./search-journeys.js";
import type { JourneysToolDeps } from "./shared.js";

export function registerJourneyTools(registerDomainTool: RegisterDomainTool, deps: JourneysToolDeps): void {
  registerDomainTool(createSearchJourneysTool(deps));
  registerDomainTool(createGetJourneyDetailsTool(deps));
  registerDomainTool(createGetJourneysSummaryTool(deps));
  registerDomainTool(createSearchDriversTool(deps));
  registerDomainTool(createGetDriverDetailsTool(deps));
  registerDomainTool(createGetDriversSummaryTool(deps));
  registerDomainTool(createSearchIdentifiersTool(deps));
  registerDomainTool(createGetIdentifiersSummaryTool(deps));
  registerDomainTool(createGetAvailableVehiclesForJourneyTool(deps));
  registerDomainTool(createGetIdentifierHistoryTool(deps));
}
