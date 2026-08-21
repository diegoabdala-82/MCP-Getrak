import type { RegisterDomainTool } from "../../server.js";
import { createGetAllAvailableFeaturesTool } from "./get-all-available-features.js";
import { createGetCentralFeatureFlagsTool } from "./get-central-feature-flags.js";
import { createGetCentralFeaturesTool } from "./get-central-features.js";
import type { FeaturesToolDeps } from "./shared.js";

export function registerFeatureTools(registerDomainTool: RegisterDomainTool, deps: FeaturesToolDeps): void {
  registerDomainTool(createGetCentralFeaturesTool(deps));
  registerDomainTool(createGetCentralFeatureFlagsTool(deps));
  registerDomainTool(createGetAllAvailableFeaturesTool(deps));
}
