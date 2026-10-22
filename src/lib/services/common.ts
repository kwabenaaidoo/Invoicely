export type ServiceErrorCode = "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "FORBIDDEN" | "UNAUTHORIZED" | "RATE_LIMITED" | "INTERNAL";

const HTTP: Record<ServiceErrorCode, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Domain error shared by server actions and the REST API. */
export class ServiceError extends Error {
  readonly status: number;
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = HTTP[code];
  }
}

/** Public, prefixed identifiers used in the REST API and shareable URLs. */
export const PREFIX = { invoice: "inv_", client: "cli_", product: "prod_", webhook: "whk_" } as const;

export const toPublicId = (prefix: string, publicId: string) => `${prefix}${publicId}`;

export function fromPublicId(prefix: string, value: string): string | null {
  if (value.startsWith(prefix)) value = value.slice(prefix.length);
  return /^[0-9a-f]{32}$/.test(value) ? value : null;
}

export type Ctx = { businessId: string; userId: string | null };
