import { describe, expect, it } from "vitest";
import { unwrapTemplateBlocks } from "./unwrap-template-blocks";

describe("unwrapTemplateBlocks", () => {
  it("replaces a templateBlock node with its own children, preserving order", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "antes" }] },
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Vitamina D 2000ui" }] },
            { type: "paragraph", content: [{ type: "text", text: "Tomar 1 cápsula ao dia" }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "depois" }] },
      ],
    };

    expect(unwrapTemplateBlocks(doc)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "antes" }] },
        { type: "paragraph", content: [{ type: "text", text: "Vitamina D 2000ui" }] },
        { type: "paragraph", content: [{ type: "text", text: "Tomar 1 cápsula ao dia" }] },
        { type: "paragraph", content: [{ type: "text", text: "depois" }] },
      ],
    });
  });

  it("handles multiple templateBlocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
        },
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
        },
      ],
    };

    expect(unwrapTemplateBlocks(doc).content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "A" }] },
      { type: "paragraph", content: [{ type: "text", text: "B" }] },
    ]);
  });

  it("returns a doc with no templateBlock unchanged", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "sem blocos" }] }],
    };

    expect(unwrapTemplateBlocks(doc)).toEqual(doc);
  });
});
