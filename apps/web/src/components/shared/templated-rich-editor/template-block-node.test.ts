// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { Editor, type Content } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

function makeEditor(content: Content) {
  return new Editor({
    extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock],
    content,
  });
}

describe("templateBlock node", () => {
  it("round-trips through JSON, preserving attrs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
        },
      ],
    };

    const editor = makeEditor(doc);

    expect(editor.getJSON()).toEqual(doc);
    editor.destroy();
  });

  it("round-trips through HTML, serializing attrs as data-* attributes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
        },
      ],
    };

    const editor = makeEditor(doc);
    const html = editor.getHTML();

    expect(html).toContain('data-type="template-block"');
    expect(html).toContain('data-template-id="t1"');
    editor.destroy();
  });

  it("documents that the schema alone does not reject a templateBlock nested via raw JSON (known limitation)", () => {
    // CONFIRMED EMPIRICALLY (2026-09-16, Task 7 implementation): Tiptap's JSON
    // deserialization (`new Editor({ content })` / `setContent`) does not strictly
    // validate nested content against `content: "templateBlockContent+"` here — it
    // neither throws nor strips the invalid nesting; the nested templateBlock survives
    // unchanged in editor.getJSON(). This test documents that reality rather than
    // asserting incorrect behavior.
    //
    // Real nesting prevention does not rely on this schema restriction alone — it comes
    // from controlling where new templateBlock nodes get inserted in the first place:
    // InsertBetweenBlocks (Task 9) only ever computes positions between top-level
    // siblings via `state.doc.forEach`, so it can't produce nesting. The sidebar
    // insertion in TemplatedRichEditor (Task 12) resolves the insertion position to the
    // nearest top-level boundary before inserting, specifically to close this gap. And
    // unwrapTemplateBlocks (Task 6) already handles nested templateBlocks correctly as a
    // safety net regardless, so even if nesting occurred through some other path, PDF/
    // preview generation would still flatten it correctly.
    const nestedDoc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [
            {
              type: "templateBlock",
              attrs: {},
              content: [{ type: "paragraph", content: [{ type: "text", text: "aninhado" }] }],
            },
          ],
        },
      ],
    };

    const editor = makeEditor(nestedDoc);
    const outer = editor.getJSON().content?.[0];
    const inner = outer?.content?.[0];

    expect(inner?.type).toBe("templateBlock");
    editor.destroy();
  });
});
