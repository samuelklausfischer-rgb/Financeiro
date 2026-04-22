# Serviços e Integrações

A aplicação utiliza uma abordagem híbrida de serviços de backend para persistência de dados e autenticação.

## 📦 PocketBase

O **PocketBase** é utilizado como o backend principal para várias coleções de dados devido à sua simplicidade e performance.

- **Arquivos de Serviço:** Localizados em `src/services/`.
- **Uso:** Armazenamento de registros de pagamentos, recebedores e logs de análise.
- **Configuração:** Geralmente configurado via uma instância global acessível pela aplicação.

## ⚡ Supabase

O **Supabase** é integrado para fornecer funcionalidades adicionais de banco de dados SQL e autenticação robusta.

- **Diretório:** `src/supabase/`.
- **Funcionalidades:** Pode ser utilizado para consultas complexas, Realtime e armazenamento de arquivos grandes, dependendo da configuração específica do projeto.

## 🔄 Camada de Serviços (`src/services/`)

A aplicação centraliza a lógica de comunicação nos seguintes arquivos:

- **`pagamentos.ts`**: Métodos para CRUD de pagamentos.
- **`recebedores.ts`**: Gestão de dados de fornecedores.
- **`analise-duplicidade.ts`**: Lógica de detecção de duplicidade via API.
- **`prn.ts`**: Processamento de dados relacionados ao formato PRN.
- **`alertas.ts`**: Sistema de notificações e alertas baseados em eventos do banco.

---

### Exemplo de Uso (Padrão)

```typescript
import { pb } from '@/lib/pocketbase';

export const getPagamentos = async () => {
  return await pb.collection('pagamentos').getFullList();
};
```
