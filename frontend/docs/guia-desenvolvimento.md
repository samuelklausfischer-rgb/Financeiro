# Guia de Desenvolvimento

Instruções para desenvolvedores que desejam contribuir ou manter o projeto.

## 🛠 Pré-requisitos

- Node.js (versão recomendada no `package.json`).
- Gerenciador de pacotes: `npm`, `pnpm` ou `bun` (o projeto possui arquivos de lock para todos, mas recomenda-se consistência).

## 🚀 Scripts Disponíveis

No diretório raiz, você pode executar:

- `npm run dev`: Inicia o servidor de desenvolvimento Vite.
- `npm run build`: Gera a build de produção na pasta `/dist`.
- `npm run lint`: Executa o **Oxlint** para análise estática rápida do código.
- `npm run format`: Formata o código usando o **Oxfmt**.
- `npm run preview`: Visualiza localmente a build de produção gerada.

## 🛡 Qualidade de Código

Este projeto utiliza ferramentas de alto desempenho para manter a qualidade:

1. **Oxlint**: Um linter extremamente rápido escrito em Rust. Use `npm run lint:fix` para corrigir problemas automaticamente.
2. **Oxfmt**: Formatador de código ultra-rápido. Substitui o Prettier para garantir consistência visual.
3. **TypeScript**: Tipagem estrita é encorajada para evitar erros em tempo de execução.

## 🎨 Adicionando Componentes UI

O projeto utiliza **Shadcn UI**. Para adicionar novos componentes, use o CLI:

```bash
npx shadcn-ui@latest add [nome-do-componente]
```

Os novos componentes serão instalados em `src/components/ui/`.

## 📦 Gerenciamento de Dependências

Mantenha as dependências atualizadas, mas verifique sempre a compatibilidade com o **React 19**, que é a base deste projeto.
