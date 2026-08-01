import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="history">Histórico</TabsTrigger>
        <TabsTrigger value="documents">Documentos</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-sm">Resumo do cadastro e próximas consultas.</p>
      </TabsContent>
      <TabsContent value="history">
        <p className="text-sm">Linha do tempo com todos os atendimentos anteriores.</p>
      </TabsContent>
      <TabsContent value="documents">
        <p className="text-sm">Exames e laudos anexados pelo paciente.</p>
      </TabsContent>
    </Tabs>
  ),
};
