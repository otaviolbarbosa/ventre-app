import { mergeAttributes, Node } from "@tiptap/core";
import BulletList from "@tiptap/extension-bullet-list";
import Heading from "@tiptap/extension-heading";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TemplateBlockView } from "./template-block-view";

export type TemplateBlockScope = "personal" | "global";

export interface TemplateBlockAttrs {
  templateId: string | null;
  templateScope: TemplateBlockScope | null;
  label: string | null;
}

export interface TemplateBlockOptions {
  onRequestSave: (pos: number, attrs: TemplateBlockAttrs) => void;
  onRequestDelete: (pos: number, attrs: TemplateBlockAttrs) => void;
}

const TEMPLATE_BLOCK_CONTENT_GROUP = "templateBlockContent";

export const TemplateBlockParagraph = Paragraph.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockHeading = Heading.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockBulletList = BulletList.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockOrderedList = OrderedList.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlock = Node.create<TemplateBlockOptions>({
  name: "templateBlock",
  group: "block",
  content: `${TEMPLATE_BLOCK_CONTENT_GROUP}+`,
  draggable: true,
  isolating: true,

  addOptions() {
    return {
      // Real handlers are provided via .configure() in Task 12; these are just safe
      // defaults so calling them before configuration doesn't throw.
      onRequestSave: () => undefined,
      onRequestDelete: () => undefined,
    };
  },

  addAttributes() {
    return {
      templateId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-template-id"),
        renderHTML: (attributes) => ({ "data-template-id": attributes.templateId }),
      },
      templateScope: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-template-scope"),
        renderHTML: (attributes) => ({ "data-template-scope": attributes.templateScope }),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({ "data-label": attributes.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="template-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "template-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateBlockView);
  },
});
