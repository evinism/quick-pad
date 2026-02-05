import { Document } from "./document";
import { TextOp, apply, simpleDiff } from "./ot";
import assert from "assert";

describe("OT Integration Tests", () => {
  describe("Single Client Basic Operations", () => {
    it("should handle single character insertion from empty", () => {
      const doc = new Document("test", "", 0, new Date());

      // Simulate client typing "a"
      const op: TextOp = [{ insert: "a" }];
      const result = doc.applyOp(op, 0);

      console.log("Op:", JSON.stringify(op));
      console.log("Result content:", doc.content);
      console.log("Result version:", doc.version);

      assert.strictEqual(doc.content, "a");
      assert.strictEqual(doc.version, 1);
    });

    it("should handle sequential character insertions", () => {
      const doc = new Document("test", "", 0, new Date());

      // Type "a"
      const op1: TextOp = [{ insert: "a" }];
      doc.applyOp(op1, 0);
      console.log("After 'a':", doc.content, "v" + doc.version);
      assert.strictEqual(doc.content, "a");

      // Type "b" (at end)
      const op2: TextOp = [{ retain: 1 }, { insert: "b" }];
      doc.applyOp(op2, 1);
      console.log("After 'b':", doc.content, "v" + doc.version);
      assert.strictEqual(doc.content, "ab");

      // Type "c" (at end)
      const op3: TextOp = [{ retain: 2 }, { insert: "c" }];
      doc.applyOp(op3, 2);
      console.log("After 'c':", doc.content, "v" + doc.version);
      assert.strictEqual(doc.content, "abc");
    });

    it("should handle rapid typing with simpleDiff", () => {
      const doc = new Document("test", "", 0, new Date());

      const sequence = ["a", "ab", "abc", "abcd", "abcde"];
      let prevText = "";

      for (let i = 0; i < sequence.length; i++) {
        const newText = sequence[i];
        const op = simpleDiff(prevText, newText);

        console.log(`\nStep ${i + 1}: "${prevText}" -> "${newText}"`);
        console.log("  Op:", JSON.stringify(op));
        console.log("  Base version:", doc.version);

        const result = doc.applyOp(op, doc.version);

        console.log("  Result:", doc.content);
        console.log("  New version:", doc.version);

        assert.strictEqual(doc.content, newText);
        prevText = newText;
      }

      assert.strictEqual(doc.content, "abcde");
      assert.strictEqual(doc.version, 5);
    });

    it("should detect the bug: ops based on wrong version", () => {
      const doc = new Document("test", "", 0, new Date());

      // This simulates what the client was doing wrong:
      // All ops based on version 0, but with different base texts

      const op1 = simpleDiff("", "a");
      console.log("\nOp 1 ('' -> 'a'):", JSON.stringify(op1));
      doc.applyOp(op1, 0);
      console.log("After op1:", doc.content, "v" + doc.version);

      // BUG: This op is based on version 0, but computes diff from "a" -> "aa"
      // It should be based on version 1!
      const op2 = simpleDiff("a", "aa");
      console.log("\nOp 2 ('a' -> 'aa', but claiming base v0):", JSON.stringify(op2));
      console.log("Server doc is:", doc.content, "v" + doc.version);

      try {
        doc.applyOp(op2, 0); // This should fail!
        console.log("After op2:", doc.content);
        assert.fail("Should have thrown an error");
      } catch (e: any) {
        console.log("Expected error:", e.message);
        assert.ok(e.message.includes("Retain"));
      }
    });
  });

  describe("Concurrent Edits", () => {
    it("should handle two concurrent inserts at end", () => {
      const doc = new Document("test", "hello", 0, new Date());

      // Client 1: insert " world" at end (based on v0)
      const op1 = simpleDiff("hello", "hello world");
      console.log("Client 1 op:", JSON.stringify(op1));

      // Client 2: insert "!" at end (based on v0, concurrent)
      const op2 = simpleDiff("hello", "hello!");
      console.log("Client 2 op:", JSON.stringify(op2));

      // Server receives op1 first
      doc.applyOp(op1, 0);
      console.log("After client 1:", doc.content, "v" + doc.version);
      assert.strictEqual(doc.content, "hello world");

      // Server receives op2 (needs transformation against op1)
      const result2 = doc.applyOp(op2, 0);
      console.log("After client 2:", doc.content, "v" + doc.version);
      console.log("Transformed op2:", JSON.stringify(result2.op));

      // Should have both edits
      assert.ok(doc.content.includes("world"));
      assert.ok(doc.content.includes("!"));
    });

    it("should handle concurrent edits on different lines", () => {
      const initialText = "hello\nworld";
      const doc = new Document("test", initialText, 0, new Date());

      // Client 1: types "123" at end of line 1 (position 5, after "hello")
      const op1 = simpleDiff("hello\nworld", "hello123\nworld");
      console.log("Client 1 op (add '123' at end of line 1):", JSON.stringify(op1));

      // Client 2: types "abc" after "wo" on line 2 (position 8, after "hello\nwo")
      const op2 = simpleDiff("hello\nworld", "hello\nwoabcrld");
      console.log("Client 2 op (add 'abc' after 'wo'):", JSON.stringify(op2));

      // Server receives client 1's op first
      const result1 = doc.applyOp(op1, 0);
      console.log("Server after client 1:", JSON.stringify(doc.content), "v" + doc.version);
      assert.strictEqual(doc.content, "hello123\nworld");

      // Server receives client 2's op (needs transformation against client 1's op)
      const result2 = doc.applyOp(op2, 0);
      console.log("Server after client 2:", JSON.stringify(doc.content), "v" + doc.version);
      console.log("Transformed client 2 op:", JSON.stringify(result2.op));

      // Final result should have both edits
      assert.strictEqual(doc.content, "hello123\nwoabcrld");
      console.log("✓ Final text is correct:", JSON.stringify(doc.content));
    });
  });
});
