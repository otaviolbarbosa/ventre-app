import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Primitives/Form",
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          "Integração com `react-hook-form` + `zod`, seguindo o padrão de formulários do projeto: schema fora do componente e `FormField` + `FormMessage` para exibir erros de validação. `Form` é o `FormProvider` do react-hook-form — seu valor é sempre o retorno de `useForm()`, por isso as stories abaixo não usam `args`.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const profileSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileFormExample() {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => undefined)} className="w-80 space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Maria da Silva" {...field} />
              </FormControl>
              <FormDescription>Como aparecerá no cadastro.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="maria@exemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Salvar</Button>
      </form>
    </Form>
  );
}

export const Playground: Story = {
  render: () => <ProfileFormExample />,
};

function ProfileFormWithErrorsExample() {
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", email: "" },
    mode: "onSubmit",
  });

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          form.trigger();
        }}
        className="w-80 space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Maria da Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="maria@exemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline">
          Validar (exibir erros)
        </Button>
      </form>
    </Form>
  );
}

export const WithValidationErrors: Story = {
  render: () => <ProfileFormWithErrorsExample />,
};
