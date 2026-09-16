import type { JSONContent } from "@tiptap/core";

export function unwrapTemplateBlocks(node: JSONContent): JSONContent {
  if (!node.content) return node;

  return {
    ...node,
    content: node.content.flatMap((child) => {
      const unwrapped = unwrapTemplateBlocks(child);
      return unwrapped.type === "templateBlock" ? (unwrapped.content ?? []) : [unwrapped];
    }),
  };
}
