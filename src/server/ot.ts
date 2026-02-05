// Operational Transformation utilities for plain text operations

export type TextOp = Array<
  | { retain: number }
  | { insert: string }
  | { delete: number }
>;

/**
 * Apply a TextOp to a string, returning the transformed string.
 */
export function apply(op: TextOp, text: string): string {
  let result = "";
  let pos = 0;

  for (const component of op) {
    if ("retain" in component) {
      const n = component.retain;
      if (pos + n > text.length) {
        throw new Error(`Retain ${n} exceeds text length ${text.length} at position ${pos}`);
      }
      result += text.slice(pos, pos + n);
      pos += n;
    } else if ("insert" in component) {
      result += component.insert;
      // pos doesn't advance for inserts
    } else if ("delete" in component) {
      const n = component.delete;
      if (pos + n > text.length) {
        throw new Error(`Delete ${n} exceeds text length ${text.length} at position ${pos}`);
      }
      pos += n;
      // don't add deleted text to result
    }
  }

  if (pos !== text.length) {
    throw new Error(`Op did not consume entire text. Position ${pos}, length ${text.length}`);
  }

  return result;
}

/**
 * Transform op1 against op2, returning a new op that has the same effect
 * as applying op1 then op2, but when applied after op2.
 *
 * This implements the standard OT transform for text operations.
 * Uses a component-by-component approach without mutating inputs.
 */
export function transform(op1: TextOp, op2: TextOp): TextOp {
  const result: TextOp = [];

  // Create mutable copies of components with remaining counts
  const comps1: Array<{ type: 'retain' | 'insert' | 'delete'; value: number | string; remaining: number }> = [];
  for (const comp of op1) {
    if ("retain" in comp) {
      comps1.push({ type: 'retain', value: comp.retain, remaining: comp.retain });
    } else if ("insert" in comp) {
      comps1.push({ type: 'insert', value: comp.insert, remaining: comp.insert.length });
    } else if ("delete" in comp) {
      comps1.push({ type: 'delete', value: comp.delete, remaining: comp.delete });
    }
  }

  const comps2: Array<{ type: 'retain' | 'insert' | 'delete'; value: number | string; remaining: number }> = [];
  for (const comp of op2) {
    if ("retain" in comp) {
      comps2.push({ type: 'retain', value: comp.retain, remaining: comp.retain });
    } else if ("insert" in comp) {
      comps2.push({ type: 'insert', value: comp.insert, remaining: comp.insert.length });
    } else if ("delete" in comp) {
      comps2.push({ type: 'delete', value: comp.delete, remaining: comp.delete });
    }
  }

  let i1 = 0, i2 = 0;

  while (i1 < comps1.length || i2 < comps2.length) {
    const c1 = i1 < comps1.length ? comps1[i1] : undefined;
    const c2 = i2 < comps2.length ? comps2[i2] : undefined;

    // 1. Handle c1 Insert
    // If c1 is an insert, it always gets emitted immediately (we prioritize op1 coming first in tie-breaks)
    if (c1 && c1.type === 'insert') {
      result.push({ insert: c1.value as string });
      i1++;
      continue;
    }

    // 2. Handle c2 Insert
    // If c2 is an insert, op1 must retain it (skip over the new text)
    if (c2 && c2.type === 'insert') {
      result.push({ retain: (c2.value as string).length });
      i2++;
      continue;
    }

    // 3. Handle End of Ops
    if (!c1) {
      // c1 is exhausted, but c2 might have more components.
      // If c2 has inserts, they are handled above.
      // If c2 has retains/deletes, we ignore them (op1 already covered the base doc).
      // But to be safe and ensure progress if something is weird:
      i2++;
      continue;
    }
    if (!c2) {
      // c2 is exhausted. c1 has leftovers.
      // If c1 has inserts, handled above.
      // If c1 has retains/deletes, append them.
      if (c1.type === 'retain') {
        result.push({ retain: c1.remaining });
      } else if (c1.type === 'delete') {
        result.push({ delete: c1.remaining });
      }
      i1++;
      continue;
    }

    // 4. Both are Retain/Delete
    if (c1.type === 'retain') {
      if (c2.type === 'retain') {
        const min = Math.min(c1.remaining, c2.remaining);
        result.push({ retain: min });
        c1.remaining -= min;
        c2.remaining -= min;
        if (c1.remaining === 0) i1++;
        if (c2.remaining === 0) i2++;
      } else { // c2.type === 'delete'
        const min = Math.min(c1.remaining, c2.remaining);
        // op2 deletes what op1 would retain - we skip that part (prune it)
        // No output to result
        c1.remaining -= min;
        c2.remaining -= min;
        if (c1.remaining === 0) i1++;
        if (c2.remaining === 0) i2++;
      }
    } else { // c1.type === 'delete'
      if (c2.type === 'retain') {
        const min = Math.min(c1.remaining, c2.remaining);
        // op1 deletes what op2 retains - we delete it
        result.push({ delete: min });
        c1.remaining -= min;
        c2.remaining -= min;
        if (c1.remaining === 0) i1++;
        if (c2.remaining === 0) i2++;
      } else { // c2.type === 'delete'
        const min = Math.min(c1.remaining, c2.remaining);
        // Both delete the same text - we only need to delete once (it's already gone)
        // No output to result (op1's delete is redundant)
        c1.remaining -= min;
        c2.remaining -= min;
        if (c1.remaining === 0) i1++;
        if (c2.remaining === 0) i2++;
      }
    }
  }

  return result;
}

/**
 * Transform a cursor position through an operation.
 * Returns the new position after the operation is applied.
 */
export function transformPosition(pos: number, op: TextOp): number {
  let result = pos;
  let currentPos = 0;

  for (const component of op) {
    if ("retain" in component) {
      const end = currentPos + component.retain;
      if (pos <= end) {
        // Position is within this retain, no change needed
        return result;
      }
      currentPos = end;
    } else if ("insert" in component) {
      if (currentPos < pos) {
        // Insert happens before our position, so position moves forward
        result += component.insert.length;
      }
      // currentPos doesn't advance for inserts
    } else if ("delete" in component) {
      const end = currentPos + component.delete;
      if (pos <= currentPos) {
        // Delete happens before our position, no change
      } else if (pos <= end) {
        // Position is within deleted range, move it to start of delete
        result = currentPos;
        return result;
      } else {
        // Delete happens before position, move position back
        result -= component.delete;
      }
      currentPos = end;
    }
  }

  return result;
}


/**
 * Simple optimistic diff: finds longest common prefix and suffix,
 * assumes a single contiguous change in the middle.
 */
export function simpleDiff(oldText: string, newText: string): TextOp {
  // Find longest common prefix
  let prefixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  // Find longest common suffix
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Extract the changed middle parts
  const oldMiddle = oldText.substring(prefixLen, oldText.length - suffixLen);
  const newMiddle = newText.substring(prefixLen, newText.length - suffixLen);

  // Build the operation
  const op: TextOp = [];
  if (prefixLen > 0) {
    op.push({ retain: prefixLen });
  }
  if (oldMiddle.length > 0) {
    op.push({ delete: oldMiddle.length });
  }
  if (newMiddle.length > 0) {
    op.push({ insert: newMiddle });
  }
  if (suffixLen > 0) {
    op.push({ retain: suffixLen });
  }

  // If no change, return a single retain
  if (op.length === 0) {
    return [{ retain: oldText.length }];
  }

  return op;
}

export interface DocState {
  version: number;
  content: string;
}

export interface ProcessResult {
  newDocState: DocState;
  opToBroadcast: TextOp;
  appliedVersion: number;
}

/**
 * Process a direct operation from a client.
 * Transforms the op against the history of operations since baseVersion.
 */
export function processOperation(
  docState: DocState,
  op: TextOp,
  baseVersion: number,
  getOpAtVersion: (v: number) => TextOp | undefined
): ProcessResult {
  // Transform incoming op from baseVersion -> current version
  let transformedOp = op;
  for (let v = baseVersion; v < docState.version; v++) {
    const remote = getOpAtVersion(v + 1);
    if (remote) {
      transformedOp = transform(transformedOp, remote);
    }
  }

  // Apply to document
  const newContent = apply(transformedOp, docState.content);
  const newVersion = docState.version + 1;

  return {
    newDocState: {
      version: newVersion,
      content: newContent,
    },
    opToBroadcast: transformedOp,
    appliedVersion: newVersion,
  };
}

/**
 * Process a full text update from a client.
 * Diffs the oldText (base) and newText to create an op, then transforms it.
 */
export function processTextUpdate(
  docState: DocState,
  oldText: string,
  newText: string,
  baseVersion: number,
  getOpAtVersion: (v: number) => TextOp | undefined
): ProcessResult {
  // Compute diff from oldText to newText
  const op = simpleDiff(oldText, newText);

  // Use processOperation to handle the transformation and application
  return processOperation(docState, op, baseVersion, getOpAtVersion);
}
