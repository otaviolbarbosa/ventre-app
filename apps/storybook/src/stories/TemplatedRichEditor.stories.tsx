import type { Tables } from "@ventre/supabase/types";
import {
  TemplatedRichEditor,
  type TemplatedRichEditorProps,
} from "@ventre/ui/shared/templated-rich-editor";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/TemplatedRichEditor",
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Editor de texto rico onde o conteúdo é composto por blocos reutilizáveis ("modelos"). Cada bloco pode vir de um modelo salvo (lista "Modelos" à direita), ser editado livremente, reordenado por drag-and-drop, e salvo de volta como modelo (sobrescrevendo o atual ou criando um novo). É a base para as futuras telas de prescrição/atestado/laudo — não conhece Supabase nem next-safe-action diretamente, recebe tudo via props (`templates`, `onOverwriteTemplate`, `onCreateTemplate`), então as stories abaixo simulam um backend em memória.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Content = TemplatedRichEditorProps["content"];

let mockIdCounter = 0;

function makeTemplate(
  overrides: Partial<Tables<"document_templates">> &
    Pick<Tables<"document_templates">, "title" | "content">,
): Tables<"document_templates"> {
  mockIdCounter += 1;
  return {
    id: `mock-${mockIdCounter}`,
    owner_id: "mock-professional",
    scope: "personal",
    category: "exame",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const vitaminaD = makeTemplate({
  title: "Vitamina D",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Vitamina D ..................... 2000ui" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Tomar 01 cápsula, VO, 1x ao dia." }] },
    ],
  },
});

const hemogramaCompleto = makeTemplate({
  title: "Hemograma completo",
  content: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "SOLICITO:" }] },
      { type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA COMPLETO" }] },
      { type: "paragraph", content: [{ type: "text", text: "GLICEMIA" }] },
      { type: "paragraph", content: [{ type: "text", text: "TSH" }] },
    ],
  },
});

const omega3 = makeTemplate({
  title: "Ômega 3",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Ômega 3 EPA 360mg e DHA 240mg ..... contínuo" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Tomar 02 cápsulas, VO, ao dia." }] },
    ],
  },
});

const INITIAL_TEMPLATES: Tables<"document_templates">[] = [omega3, vitaminaD, hemogramaCompleto];

const EMPTY_DOC: Content = { type: "doc", content: [{ type: "paragraph" }] };

function templateBlockFrom(template: Tables<"document_templates">) {
  const templateContent = template.content as Content;
  return {
    type: "templateBlock",
    attrs: { templateId: template.id, templateScope: template.scope, label: template.title },
    content: templateContent.content ?? [{ type: "paragraph" }],
  };
}

function TemplatedRichEditorExample({
  initialContent = EMPTY_DOC,
  initialTemplates = INITIAL_TEMPLATES,
  disabled = false,
}: {
  initialContent?: Content;
  initialTemplates?: Tables<"document_templates">[];
  disabled?: boolean;
}) {
  const [content, setContent] = useState<Content>(initialContent);
  const [templates, setTemplates] = useState<Tables<"document_templates">[]>(initialTemplates);

  return (
    <div className="max-w-4xl">
      <TemplatedRichEditor
        content={content}
        onChange={setContent}
        templates={templates}
        disabled={disabled}
        onOverwriteTemplate={async (templateId, newContent) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          setTemplates((current) =>
            current.map((t) => (t.id === templateId ? { ...t, content: newContent } : t)),
          );
        }}
        onCreateTemplate={async (title, newContent) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          const template = makeTemplate({ title, content: newContent });
          setTemplates((current) => [...current, template]);
          return { id: template.id };
        }}
      />
    </div>
  );
}

export const Playground: Story = {
  render: () => <TemplatedRichEditorExample />,
};

export const WithExistingBlocks: Story = {
  render: () => (
    <TemplatedRichEditorExample
      initialContent={{
        type: "doc",
        content: [templateBlockFrom(vitaminaD), templateBlockFrom(hemogramaCompleto)],
      }}
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <TemplatedRichEditorExample
      disabled
      initialContent={{
        type: "doc",
        content: [templateBlockFrom(vitaminaD)],
      }}
    />
  ),
};

export const NoSavedTemplates: Story = {
  render: () => <TemplatedRichEditorExample initialTemplates={[]} />,
};
