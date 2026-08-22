/**
 * Frontend data boundary.
 *
 * V2-S0 intentionally keeps the existing in-memory/mock implementation. This
 * adapter is the only feature-facing entry point for that implementation, so
 * a future repository/API adapter can replace it without rewriting UI code.
 */
export * from "@domain/data.js";
