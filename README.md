# Studio.Agenda 📅

Sistema de agendamento de serviços online com seleção de horários disponíveis, reservas com múltiplos serviços, confirmação visual para o cliente e painel administrativo para gestão de agendamentos, serviços e status da agenda.

A aplicação permite que clientes escolham um ou mais serviços, informem seus dados e reservem um horário. O sistema calcula a duração total dos serviços selecionados e bloqueia automaticamente o intervalo ocupado para evitar conflitos e sobreposição de horários.

## 🚀 Tecnologias Utilizadas

- **React** para construção da interface.
- **TanStack Start / TanStack Router** para rotas e server functions.
- **TypeScript** para tipagem estática.
- **Supabase** como backend, autenticação e banco de dados PostgreSQL.
- **Supabase RLS** para regras de segurança no banco.
- **Tailwind CSS** para estilização responsiva.
- **Radix UI** para componentes acessíveis.
- **React Query** para cache, refetch e revalidação de dados.
- **Vite** para desenvolvimento e build.
- **Vercel** para hospedagem e deploy contínuo.

## 🤖 Ferramentas de IA Utilizadas no Desenvolvimento

Este projeto foi desenvolvido com apoio de ferramentas de inteligência artificial para acelerar prototipagem, implementação e correções:

- **Lovable**: utilizado para prototipagem rápida da interface, criação de componentes reativos e integração inicial do fluxo da aplicação.
- **Codex**: utilizado para análise de código, implementação de regras de negócio, correções de bugs, ajustes de Supabase, migrations, validação de horários e melhorias no fluxo administrativo.

## 🧑‍💻 Como Executar Localmente

### Pré-requisitos

Antes de começar, instale:

- **Node.js** 20 ou superior.
- **npm**.
- Conta/projeto no **Supabase**.
- Opcional: **Supabase CLI** para aplicar migrations localmente/remotamente.

### 1. Clonar o repositório

```sh
git clone <url-do-repositorio>
cd Studio.Agenda
```

### 2. Instalar as dependências

```sh
npm install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as chaves do Supabase.

```env
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anon"
```

Este projeto também utiliza variáveis no padrão Vite/Supabase. Caso necessário, configure também:

```env
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
```

### 4. Rodar em modo de desenvolvimento

```sh
npm run dev
```

Depois, acesse a URL exibida no terminal, normalmente:

```sh
http://localhost:5173
```

### 5. Gerar build de produção

```sh
npm run build
```

## 🔐 Credenciais de Acesso

Solicite as credenciais de demonstração ao responsável pelo projeto.

## 🧠 Decisões Técnicas Adotadas

### Supabase

O **Supabase** foi escolhido por oferecer autenticação, banco PostgreSQL, funções RPC e regras de segurança com **Row Level Security (RLS)** em uma plataforma única. Isso facilita a criação de um backend seguro para operações públicas, como criação de agendamentos, e operações protegidas, como gestão administrativa.

### Vercel

A **Vercel** foi escolhida pela integração simples com GitHub, deploy contínuo e boa performance para aplicações frontend com funções serverless. Cada push na branch principal pode gerar uma nova versão publicada automaticamente.

### Lógica de Agendamento Múltiplo

A aplicação permite selecionar vários serviços no mesmo agendamento. Para isso, o sistema soma a duração total dos serviços e calcula o intervalo ocupado:

```txt
horário_final = horário_inicial + duração_total_dos_serviços
```

Exemplo:

```txt
Cabelo: 60 min
Barba: 30 min
Total: 90 min

Início: 13:00
Fim: 14:30
```

Esse intervalo completo é usado para bloquear horários e impedir sobreposição com outros agendamentos já existentes.

### Validação de Horários

A validação ocorre em duas camadas:

- **Frontend**: pré-filtra os horários disponíveis considerando a duração total e o horário de funcionamento.
- **Backend/Supabase**: valida novamente antes de inserir no banco, garantindo segurança contra conflitos, duplicidade ou requisições inválidas.

### Desenvolvimento Guiado por IA

O desenvolvimento foi acelerado com apoio do **Lovable** para criação e refinamento visual da aplicação, e do **Codex** para análise técnica, correções de lógica, ajustes de migrations, testes e melhorias de fluxo.

## 📦 Scripts Disponíveis

```sh
npm run dev
```

Inicia o servidor local de desenvolvimento.

```sh
npm run build
```

Gera o build de produção.

```sh
npm run preview
```

Executa uma prévia local do build.

```sh
npm run lint
```

Executa a verificação de lint.

```sh
npm run format
```

Formata os arquivos do projeto com Prettier.

## 📁 Estrutura Geral

```txt
src/
  components/          Componentes reutilizáveis
  integrations/        Configuração de integrações, como Supabase
  lib/                 Funções de negócio e utilitários
  routes/              Rotas da aplicação

supabase/
  migrations/          Migrations SQL do banco de dados
```

## ✅ Funcionalidades Principais

- Agendamento online de serviços.
- Seleção de múltiplos serviços em uma única reserva.
- Cálculo automático da duração total.
- Bloqueio dinâmico de horários ocupados.
- Validação contra sobreposição de agendamentos.
- Confirmação visual após reserva.
- Área administrativa protegida por login.
- Gestão de serviços.
- Atualização de status dos agendamentos.
- Layout responsivo para desktop e mobile.
