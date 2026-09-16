import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// If `pos` sits exactly at the end of an empty paragraph that itself immediately
// follows a templateBlock, that paragraph is almost certainly the auto-inserted
// cursor-accessibility placeholder ProseMirror adds after an `isolating` node when it's
// last in the doc (see templated-rich-editor.tsx's content-sync effect comment) — not
// content the user typed. Inserting a new block "after" it (the normal
// resolveTopLevelInsertPos result) would leave that placeholder stranded between two
// blocks as a visible blank line. Returning its range lets the caller replace it instead
// of inserting past it.
export function findGapParagraphRangeBefore(
  doc: ProseMirrorNode,
  pos: number,
): { from: number; to: number } | null {
  const topLevelNodes: { node: ProseMirrorNode; from: number; to: number }[] = [];
  doc.forEach((node, offset) => {
    topLevelNodes.push({ node, from: offset, to: offset + node.nodeSize });
  });

  const index = topLevelNodes.findIndex((entry) => entry.to === pos);
  if (index === -1) return null;

  const current = topLevelNodes[index];
  const isEmptyParagraph = current?.node.type.name === "paragraph" && current.node.content.size === 0;
  if (!current || !isEmptyParagraph) return null;

  const previous = topLevelNodes[index - 1];
  if (!previous || previous.node.type.name !== "templateBlock") return null;

  return { from: current.from, to: current.to };
}
