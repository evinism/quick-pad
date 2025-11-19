import { Document } from "./document";
import { TextOp } from "./ot";
import assert from "assert";

describe("Document OT", () => {
  it("should apply operations in order", () => {
    const doc = new Document("test", "hello", 0, new Date());

    // Op 1: insert " world" at end
    const op1: TextOp = [{ retain: 5 }, { insert: " world" }];
    const res1 = doc.applyOp(op1, 0);

    assert.strictEqual(doc.content, "hello world");
    assert.strictEqual(doc.version, 1);
    assert.strictEqual(res1.version, 1);
    assert.deepStrictEqual(res1.op, op1);
  });

  it("should transform out-of-order operations", () => {
    const doc = new Document("test", "hello", 0, new Date());

    // Client A: insert " world" at end (base 0)
    const opA: TextOp = [{ retain: 5 }, { insert: " world" }];
    doc.applyOp(opA, 0); // doc becomes "hello world", v1

    // Client B: insert "!" at end (base 0) - concurrent with A
    const opB: TextOp = [{ retain: 5 }, { insert: "!" }];

    // Apply opB (base 0) to doc (v1)
    // Should transform opB against opA
    const resB = doc.applyOp(opB, 0);

    // Expected: "hello world!" (A's insert came first, B's insert pushed after? Or before?)
    // Transform logic:
    // opA: retain 5, insert " world"
    // opB: retain 5, insert "!"
    // Both insert at pos 5.
    // Transform(opB, opA):
    // opA inserts " world". opB must retain 6 (" world".length) to skip it?
    // Wait, standard OT: if two inserts at same pos, one wins.
    // My transform implementation:
    // if c1 (opB) insert, emit insert.
    // if c2 (opA) insert, emit retain.
    // So opB comes first?
    // Let's check transform implementation in ot.ts
    // if c1.insert -> result.push(insert)
    // if c2.insert -> result.push(retain)
    // So opB (c1) is inserted BEFORE opA (c2).
    // So result should be "hello! world"

    assert.strictEqual(doc.content, "hello! world");
    assert.strictEqual(doc.version, 2);
  });

  it("should handle applyTextUpdate for simple case", () => {
    const doc = new Document("test", "hello", 0, new Date());

    // Update to "hello world" (base 0) - straightforward append
    doc.applyTextUpdate("hello world", 0);
    assert.strictEqual(doc.content, "hello world");
    assert.strictEqual(doc.version, 1);
  });
});
