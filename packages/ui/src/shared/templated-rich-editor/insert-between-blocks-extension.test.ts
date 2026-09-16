// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { InsertBetweenBlocks } from "./insert-between-blocks-extension";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

describe("InsertBetweenBlocks", () => {
  it("renders one insert widget before each top-level block, plus one at the end", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "um" }] },
          { type: "paragraph", content: [{ type: "text", text: "dois" }] },
        ],
      },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    expect(widgets.length).toBe(3);

    editor.destroy();
    element.remove();
  });

  it("renders a single widget for a fully empty doc (just the placeholder paragraph)", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    expect(widgets.length).toBe(1);

    editor.destroy();
    element.remove();
  });

  it("renders a single trailing widget after a templateBlock followed by its auto-inserted empty paragraph", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          {
            type: "templateBlock",
            attrs: { templateId: null, templateScope: null, label: null },
            content: [{ type: "paragraph", content: [{ type: "text", text: "bloco" }] }],
          },
          { type: "paragraph" },
        ],
      },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    // One widget before the templateBlock, one at the end — the trailing empty
    // paragraph's own "before" widget is suppressed since it sits right on top of it.
    expect(widgets.length).toBe(2);

    editor.destroy();
    element.remove();
  });

  it("clicking a widget inserts an empty templateBlock at that position", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "existente" }] }],
      },
    });

    const firstWidget = element.querySelector("[data-insert-block-at]") as HTMLButtonElement;
    firstWidget.click();

    const json = editor.getJSON();
    expect(json.content?.some((node) => node.type === "templateBlock")).toBe(true);

    editor.destroy();
    element.remove();
  });

  it("clicking the sole widget on a fully empty doc replaces the placeholder instead of inserting beside it", () => {
    // Regression test: the click handler used to do a raw `tr.insert`, which left the
    // doc's baseline empty paragraph as a real sibling next to the new block (and, with
    // TrailingNode active in the real app, another empty paragraph appended after the
    // new block too) — producing duplicate "+" widgets around the block. Confirmed live
    // in Storybook.
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    const widget = element.querySelector("[data-insert-block-at]") as HTMLButtonElement;
    widget.click();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(1);
    expect(json.content?.[0]?.type).toBe("templateBlock");

    editor.destroy();
    element.remove();
  });

  it("clicking the end widget after a templateBlock consumes its trailing gap paragraph instead of leaving it stranded", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          {
            type: "templateBlock",
            attrs: { templateId: null, templateScope: null, label: null },
            content: [{ type: "paragraph", content: [{ type: "text", text: "bloco" }] }],
          },
          { type: "paragraph" },
        ],
      },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    const endWidget = widgets[widgets.length - 1] as HTMLButtonElement;
    endWidget.click();

    const json = editor.getJSON();
    expect(json.content?.length).toBe(2);
    expect(json.content?.every((node) => node.type === "templateBlock")).toBe(true);

    editor.destroy();
    element.remove();
  });

  it("keeps the end-of-doc widget's insert position correct after the doc grows", () => {
    // Regression test: ProseMirror reuses a widget decoration's DOM node across
    // recomputes when its `key` matches the previous render's key, without necessarily
    // re-invoking the factory function. The end widget used to have a fixed key
    // ("insert-end"), so after the doc grew (e.g. a block inserted via the first
    // widget), the SAME DOM node from before the insert was reused — visually moved to
    // the new end-of-doc position, but with its `data-insert-block-at` attribute still
    // holding the stale pre-insert value baked in at creation time. Confirmed live in a
    // real browser (Storybook), not just here — no existing test exercised a second
    // decorations computation after a doc mutation, which is exactly when this bug is
    // reachable.
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "existente" }] }],
      },
    });

    const firstWidget = element.querySelector("[data-insert-block-at]") as HTMLButtonElement;
    firstWidget.click();

    const widgets = Array.from(element.querySelectorAll("[data-insert-block-at]"));
    const lastWidget = widgets[widgets.length - 1] as HTMLButtonElement;
    const actualDocSize = editor.state.doc.content.size;

    expect(Number(lastWidget.dataset.insertBlockAt)).toBe(actualDocSize);

    editor.destroy();
    element.remove();
  });

  it("renders no insert widgets when the editor is not editable", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      editable: false,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "um" }] },
          { type: "paragraph", content: [{ type: "text", text: "dois" }] },
        ],
      },
    });

    expect(element.querySelectorAll("[data-insert-block-at]").length).toBe(0);

    editor.destroy();
    element.remove();
  });
});
