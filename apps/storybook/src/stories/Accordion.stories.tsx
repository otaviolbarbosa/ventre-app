import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ventre/ui/accordion";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
  args: { type: "single" },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  {
    value: "item-1",
    trigger: "O que é o Ventre?",
    content: "Ventre é uma plataforma de gestão para profissionais de saúde da mulher.",
  },
  {
    value: "item-2",
    trigger: "Como funciona o período de teste?",
    content: "Você pode testar gratuitamente por 14 dias, sem precisar de cartão de crédito.",
  },
  {
    value: "item-3",
    trigger: "Posso cancelar quando quiser?",
    content: "Sim, o cancelamento pode ser feito a qualquer momento pelo painel de faturamento.",
  },
];

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.trigger}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" className="w-96">
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.trigger}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};
