/**
 * US-005 — Auditoria estruturada por chamada (mascaramento).
 * CLAUDE.md, Seção 8 — dados sensíveis: localização, placa, chassi, CPF,
 * CNPJ, telefone, e-mail, identificadores de cliente/subcliente/usuário/
 * motorista/equipamento, telemetria, tokens, credenciais.
 *
 * Nunca persistir integralmente: tokens, segredos, CPF, telefone, e-mail,
 * payloads sensíveis completos. Este módulo mascara/omite antes de qualquer
 * gravação em log de auditoria.
 */

export const REDACTED = "[REDACTED]";

/**
 * Nomes de campo (case-insensitive) tratados como sensíveis em qualquer
 * objeto passado para auditoria. Lista deliberadamente conservadora — em
 * dúvida, redigir.
 */
const SENSITIVE_FIELD_NAMES = new Set(
  [
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "password",
    "senha",
    "client_secret",
    "secret",
    "authorization",
    "cpf",
    "cnpj",
    "telefone",
    "phone",
    "phone_number",
    "email",
    "e_mail",
    "placa",
    "chassi",
    "chassis",
  ].map((name) => name.toLowerCase()),
);

function isSensitiveFieldName(key: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(key.toLowerCase());
}

/**
 * Aplica mascaramento profundo em um valor arbitrário (objeto, array ou
 * primitivo), redigindo qualquer campo cujo nome seja considerado sensível.
 * Usado antes de gravar qualquer estrutura em log de auditoria.
 */
export function deepMask(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepMask(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveFieldName(key) ? REDACTED : deepMask(entryValue, seen);
    }
    return result;
  }

  return value;
}
