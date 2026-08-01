import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Shared/RichEditor",
  component: RichEditor,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, layout: "fullscreen" },
  args: { content: "", onChange: () => undefined },
} satisfies Meta<typeof RichEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    function Example() {
      const [content, setContent] = useState("<p>Escreva aqui as observações do atendimento.</p>");
      return (
        <div className="mx-auto max-w-2xl rounded-md border p-4">
          <RichEditor content={content} onChange={setContent} />
        </div>
      );
    }
    return <Example />;
  },
};

export const Empty: Story = {
  render: () => {
    function Example() {
      const [content, setContent] = useState("");
      return (
        <div className="mx-auto max-w-2xl rounded-md border p-4">
          <RichEditor
            content={content}
            onChange={setContent}
            placeholder="Digite suas observações..."
          />
        </div>
      );
    }
    return <Example />;
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="mx-auto max-w-2xl rounded-md border p-4">
      <RichEditor
        content="<p>Este conteúdo não pode ser editado.</p>"
        onChange={() => undefined}
        disabled
      />
    </div>
  ),
};
