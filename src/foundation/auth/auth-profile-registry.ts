/**
 * US-047 — Selecionar deterministicamente o Auth Profile por tool.
 *
 * O auth_profile (esquema + escopo) de cada tool já é, estruturalmente,
 * fixo na implementação da tool: cada domínio hardcoda seu `AuthScheme`
 * (ex.: `ACCOUNTS_AUTH_SCHEME`, `GETRAK_WEB_AUTH_SCHEME`) e o passa
 * explicitamente a `ApiCoreClient.get()` — nunca lido de um parâmetro de
 * entrada. Nenhum schema Zod de nenhuma tool declara `scope`,
 * `auth_profile` ou `credential_id` como campo.
 *
 * O que faltava (AC de US-047, segunda cláusula): uma rejeição EXPLÍCITA e
 * transversal caso uma chamada tente informar esses parâmetros — o
 * comportamento padrão do Zod (`z.object(...).parse()`, sem `.strict()`) é
 * descartar silenciosamente chaves desconhecidas, não rejeitar a chamada.
 * Este guard roda no `ToolRuntime`, antes até do parse do schema de
 * entrada de cada tool, e vale para todas as tools sem exceção — não
 * depende de cada tool lembrar de implementar a checagem por conta própria.
 */

import { ErrorCodes, McpToolError } from "../../domain/errors.js";

/** CLAUDE.md Seção 3 / US-047: nunca aceitos como parâmetro livre de tool. */
export const FORBIDDEN_AUTH_INPUT_KEYS = ["scope", "auth_profile", "credential_id"] as const;

/**
 * Rejeita a chamada se o input bruto (antes de qualquer validação de
 * schema específico da tool) contiver algum dos parâmetros proibidos de
 * seleção de auth profile.
 */
export function assertNoForbiddenAuthParams(rawInput: unknown): void {
  if (rawInput === null || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return;
  }

  const offendingKey = Object.keys(rawInput as Record<string, unknown>).find((key) =>
    (FORBIDDEN_AUTH_INPUT_KEYS as readonly string[]).includes(key),
  );

  if (offendingKey) {
    throw new McpToolError({
      code: ErrorCodes.VALIDATION_ERROR,
      message:
        `Parameter "${offendingKey}" is not accepted by any tool — auth profile selection (scheme + scope) ` +
        `is always resolved internally and deterministically by the tool implementation, never by a caller-supplied parameter.`,
      retryable: false,
    });
  }
}
