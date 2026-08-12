/**
 * US-007 — Descoberta de tools via protocolo MCP.
 * Converte o schema Zod de entrada de cada tool (fonte única de verdade de
 * validação) no JSON Schema exigido pela descoberta nativa do protocolo MCP,
 * evitando manter dois contratos de entrada em paralelo.
 */

import type { z } from "zod";
import { zodToJsonSchema as convert } from "zod-to-json-schema";

export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convert(schema, { target: "jsonSchema7" }) as Record<string, unknown>;
}
