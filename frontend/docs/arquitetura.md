# Arquitetura e Tecnologias

O projeto segue uma arquitetura moderna de frontend, focada em modularidade, tipagem forte e performance.

## 🛠 Stack Tecnológica

- **Core:** [React 19](https://react.dev/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Componentes UI:** [Shadcn UI](https://ui.shadcn.com/) (baseado em Radix UI)
- **Gerenciamento de Rotas:** [React Router 7](https://reactrouter.com/)
- **Formulários:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Gráficos:** [Recharts](https://recharts.org/)

## 📁 Estrutura de Pastas (`/src`)

A estrutura foi organizada para separar responsabilidades de forma clara:

- **`assets/`**: Imagens, ícones e arquivos estáticos locais.
- **`components/`**: Componentes reutilizáveis da aplicação.
  - `ui/`: Componentes base do Shadcn UI.
  - `layout/`: Componentes de estrutura (Sidebar, Header, RootLayout).
  - `analysis/` & `prn/`: Componentes específicos de cada módulo.
- **`contexts/`**: Contextos do React para gerenciamento de estado global (ex: `auth-context.tsx`).
- **`hooks/`**: Hooks customizados para lógica reutilizável.
- **`lib/`**: Configurações de bibliotecas externas (ex: `utils.ts` do Tailwind).
- **`pages/`**: Páginas principais da aplicação que representam as rotas.
- **`services/`**: Camada de comunicação com APIs e serviços externos.
- **`supabase/` & `pocketbase/`**: Configurações e esquemas relacionados ao Backend-as-a-Service.

## 📐 Padrões de Projeto

- **Componentes Funcionais:** Uso exclusivo de Hooks e componentes funcionais.
- **Tipagem:** Interfaces TypeScript para todos os modelos de dados e props.
- **Estilização:** Padrão Utility-first com Tailwind, garantindo responsividade e modo escuro/claro nativo.
