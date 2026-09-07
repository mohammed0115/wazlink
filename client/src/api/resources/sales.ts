/**
 * Pipeline and deals.
 *
 * A Deal's `value` is a FORECAST. Closing a deal Won does NOT recognize
 * revenue: recognition is an explicit, separately-permissioned command in the
 * finance boundary (`POST /revenue/events`). Nothing in this file may imply
 * otherwise, and no function here calls that endpoint.
 */
import { api, newIdempotencyKey, type Page } from "../http";
import type { DealPayload, PipelinePayload } from "../types";

export const pipelineApi = {
  list: (signal?: AbortSignal) => api.get<{ items: PipelinePayload[] }>("/pipelines", { signal }),
};

export const dealsApi = {
  list: (query: { status?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<Page<DealPayload>>("/deals", { query: { ...query }, signal }),

  get: (dealRef: string, signal?: AbortSignal) =>
    api.get<DealPayload>(`/deals/${encodeURIComponent(dealRef)}`, { signal }),

  /** A deal attaches to a Lead or a Customer — neither requires a Business. */
  create: (
    input: {
      title: string;
      lead_ref?: string;
      customer_ref?: string;
      value?: string | number;
      currency?: string;
    },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<DealPayload>("/deals", { body: input, idempotencyKey }),

  moveStage: (dealRef: string, stageRef: string, version: number) =>
    api.post<DealPayload>(`/deals/${encodeURIComponent(dealRef)}/stage`, {
      body: { stage_ref: stageRef },
      ifMatch: version,
    }),

  /**
   * Close won/lost. Gated above ordinary update by `deal.close`. Winning a
   * deal changes deal status only — it creates no RevenueEvent.
   */
  close: (
    dealRef: string,
    outcome: "won" | "lost",
    version: number,
    lossReason = "",
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<DealPayload>(`/deals/${encodeURIComponent(dealRef)}/close`, {
      body: { outcome, loss_reason: lossReason },
      ifMatch: version,
      idempotencyKey,
    }),
};
