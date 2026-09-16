// @vitest-environment happy-dom
import { Editor, type Content } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";
import { findGapParagraphRangeBefore } from "./find-gap-paragraph-range";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

function makeEditor(content: Content) {
  return new Editor({
    extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock],
    content,
  });
}

describe("findGapParagraphRangeBefore", () => {
  it("returns the range of an empty paragraph that immediately follows a templateBlock", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
        { type: "paragraph" },
      ],
    });

    const docEnd = editor.state.doc.content.size;
    const range = findGapParagraphRangeBefore(editor.state.doc, docEnd);

    expect(range).not.toBeNull();
    // The trailing paragraph's range should span from right after the templateBlock to
    // the very end of the doc.
    const templateBlockSize = editor.state.doc.firstChild?.nodeSize ?? 0;
    expect(range).toEqual({ from: templateBlockSize, to: docEnd });

    editor.destroy();
  });

  it("returns null when the position doesn't land exactly at a top-level node boundary", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
        { type: "paragraph" },
      ],
    });

    // A position in the middle of the templateBlock's text, not a top-level boundary.
    const range = findGapParagraphRangeBefore(editor.state.doc, 3);

    expect(range).toBeNull();
    editor.destroy();
  });

  it("returns null when the trailing node is not empty", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
        { type: "paragraph", content: [{ type: "text", text: "não está vazio" }] },
      ],
    });

    const docEnd = editor.state.doc.content.size;
    const range = findGapParagraphRangeBefore(editor.state.doc, docEnd);

    expect(range).toBeNull();
    editor.destroy();
  });

  it("returns null when the empty paragraph does not follow a templateBlock", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "texto normal" }] },
        { type: "paragraph" },
      ],
    });

    const docEnd = editor.state.doc.content.size;
    const range = findGapParagraphRangeBefore(editor.state.doc, docEnd);

    expect(range).toBeNull();
    editor.destroy();
  });

  it("returns null for a doc with a single templateBlock and no trailing paragraph", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "único bloco" }] }],
        },
      ],
    });

    const docEnd = editor.state.doc.content.size;
    const range = findGapParagraphRangeBefore(editor.state.doc, docEnd);

    expect(range).toBeNull();
    editor.destroy();
  });
});
