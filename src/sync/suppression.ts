import type { Ledger } from "../ledger.js";
import type { Source } from "../types.js";

export class SuppressionStore {
  constructor(private readonly ledger: Ledger) {}

  suppress(eventId: string, targetSource: Source, targetId: string): void {
    this.ledger.createSuppression(eventId, targetSource, targetId);
  }

  isSuppressed(eventId: string): boolean {
    return this.ledger.isSuppressed(eventId);
  }
}