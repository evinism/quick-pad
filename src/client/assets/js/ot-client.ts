// Client-side OT utilities
import { TextOp, apply, transform, simpleDiff, transformPosition } from "../../../server/ot.js";

export interface PendingOp {
  opId: string;
  op: TextOp;
  baseVersion: number;
}

export interface ClientOTState {
  docId: string;
  confirmedVersion: number;
  confirmedText: string;
  outbox: PendingOp[];
}

let opCounter = 0;

export function generateOpId(): string {
  return `client-${Date.now()}-${opCounter++}`;
}

export function createInitialState(docId: string, initialText: string, initialVersion: number): ClientOTState {
  return {
    docId,
    confirmedVersion: initialVersion,
    confirmedText: initialText,
    outbox: [],
  };
}

export function handleLocalEdit(
  state: ClientOTState,
  oldText: string,
  newText: string
): { state: ClientOTState; pendingOp: PendingOp } {
  // Compute diff
  const op = simpleDiff(oldText, newText);

  // Base version should account for pending ops
  // If we have pending ops, this new op is based on those ops being applied
  const baseVersion = state.confirmedVersion + state.outbox.length;

  // Create pending op
  const pendingOp: PendingOp = {
    opId: generateOpId(),
    op,
    baseVersion,
  };

  // Add to outbox
  const newOutbox = [...state.outbox, pendingOp];

  return {
    state: { ...state, outbox: newOutbox },
    pendingOp,
  };
}

export function handleServerOp(
  state: ClientOTState,
  serverOp: TextOp,
  serverVersion: number,
  serverOpId?: string
): { state: ClientOTState; localText: string; isOwnOp: boolean } {
  // Check if this is our own op
  const ourOpIndex = state.outbox.findIndex(p => p.opId === serverOpId);

  if (ourOpIndex !== -1) {
    // OUR OP - Server acknowledged it
    // Remove from outbox
    const newOutbox = state.outbox.filter((_, i) => i !== ourOpIndex);

    // Apply server's version to confirmed state
    const newConfirmedText = apply(serverOp, state.confirmedText);

    // Recompute local text from confirmed + remaining outbox
    let localText = newConfirmedText;
    for (const pending of newOutbox) {
      localText = apply(pending.op, localText);
    }

    return {
      state: {
        ...state,
        confirmedText: newConfirmedText,
        confirmedVersion: serverVersion,
        outbox: newOutbox,
      },
      localText,
      isOwnOp: true,
    };
  } else {
    // REMOTE OP - Another client's edit
    // Apply to confirmed state
    const newConfirmedText = apply(serverOp, state.confirmedText);

    // Transform all pending ops in outbox against this remote op
    const newOutbox = state.outbox.map(pending => ({
      ...pending,
      op: transform(pending.op, serverOp),
    }));

    // Recompute local text
    let localText = newConfirmedText;
    for (const pending of newOutbox) {
      localText = apply(pending.op, localText);
    }

    return {
      state: {
        ...state,
        confirmedText: newConfirmedText,
        confirmedVersion: serverVersion,
        outbox: newOutbox,
      },
      localText,
      isOwnOp: false,
    };
  }
}

// Re-export OT utilities for convenience
export { TextOp, apply, transform, simpleDiff, transformPosition };
