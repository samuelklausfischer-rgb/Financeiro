# Documentação do Projeto: Controle Inteligente de Pagamentos

Bem-vindo à documentação técnica do sistema de Controle Inteligente de Pagamentos. Este documento serve como porta de entrada para entender a arquitetura, funcionalidades e processos de desenvolvimento do projeto.

## 📂 Estrutura da Documentação

Para facilitar a navegação, a documentação está dividida nos seguintes módulos:

1. [**Arquitetura e Tecnologias**](./arquitetura.md)
   - Stack tecnológica, organização de pastas e padrões de projeto.
2. [**Funcionalidades do Sistema**](./funcionalidades.md)
   - Detalhamento das rotas, módulos de análise (Duplicidade, PRN) e gestão.
3. [**Serviços e Integrações**](./servicos-integracoes.md)
   - Como o sistema se comunica com PocketBase e Supabase.
4. [**Guia de Desenvolvimento**](./guia-desenvolvimento.md)
   - Comandos, scripts, linting e padrões de codificação.

---

## 🚀 Visão Geral do Projeto

O **Controle Inteligente de Pagamentos** é uma plataforma robusta para gestão financeira, com foco em automação de análises e prevenção de erros (como pagamentos duplicados).

- **Frontend:** React + Vite + TypeScript.
- **UI/UX:** Tailwind CSS + Shadcn UI + Lucide Icons.
- **Backend/DB:** PocketBase & Supabase.
- **Ferramentas:** Oxlint (Linting), Oxfmt (Formatação), Vite (Build).
