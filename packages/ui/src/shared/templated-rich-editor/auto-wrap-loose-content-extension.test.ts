// @vitest-environment happy-dom
import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { describe, expect, it } from "vitest";
import { AutoWrapLooseContent } from "./auto-wrap-loose-content-extension";
import { TemplateBlock, TemplateBlockHeading, TemplateBlockParagraph } from "./template-block-node";

function makeEditor(content: object) {
  return new Editor({
    extensions: [
      Document,
      Text,
      TemplateBlockParagraph,
      TemplateBlockHeading,
      TemplateBlock,
      AutoWrapLooseContent,
    ],
    content,
  });
}

describe("AutoWrapLooseContent", () => {
  it("wraps a top-level paragraph in a templateBlock as soon as it gets typed into", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "paragraph" }] });

    editor.chain().setTextSelection(1).insertContent("a").run();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(1);
    expect(json.content?.[0]?.type).toBe("templateBlock");
    expect(json.content?.[0]?.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "a" }],
    });

    editor.destroy();
  });

  it("keeps typing inside the same templateBlock instead of wrapping again on every keystroke", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "paragraph" }] });

    editor.chain().setTextSelection(1).insertContent("a").run();
    editor.chain().insertContent("b").run();
    editor.chain().insertContent("c").run();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(1);
    expect(json.content?.[0]?.type).toBe("templateBlock");
    expect(json.content?.[0]?.content?.length).toBe(1);
    expect(json.content?.[0]?.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "abc" }],
    });

    editor.destroy();
  });

  it("wraps a loose gap paragraph typed into between two existing blocks", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: null, templateScope: null, label: null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "um" }] }],
        },
        { type: "paragraph" },
        {
          type: "templateBlock",
          attrs: { templateId: null, templateScope: null, label: null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "dois" }] }],
        },
      ],
    });

    // Position right inside the empty gap paragraph, between the two blocks.
    const gapPos = editor.state.doc.child(0).nodeSize + 1;
    editor.chain().setTextSelection(gapPos).insertContent("novo").run();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(3);
    expect(json.content?.map((node) => node.type)).toEqual([
      "templateBlock",
      "templateBlock",
      "templateBlock",
    ]);
    expect(json.content?.[1]?.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "novo" }],
    });

    editor.destroy();
  });

  it("wraps a top-level heading typed into, not just paragraphs", () => {
    const editor = makeEditor({ type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] });

    editor.chain().setTextSelection(1).insertContent("Título").run();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(1);
    expect(json.content?.[0]?.type).toBe("templateBlock");
    expect(json.content?.[0]?.content?.[0]?.type).toBe("heading");

    editor.destroy();
  });

  it("does not wrap content that already lives inside a templateBlock", () => {
    const editor = makeEditor({
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: null, templateScope: null, label: null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "existente" }] }],
        },
      ],
    });

    editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent("!").run();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(1);
    expect(json.content?.[0]?.type).toBe("templateBlock");
    expect(json.content?.[0]?.content?.length).toBe(1);

    editor.destroy();
  });
});
