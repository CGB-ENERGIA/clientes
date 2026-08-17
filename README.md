# Sistema de Apontamento · CGB Energia

Aplicação Quasar (Vue 3) com PWA para registro de postes em campo e gestão de apontamentos.

## Requisitos

- [Bun](https://bun.sh/) 1.x
- Projeto Supabase configurado

## Configuração local

1. Instale as dependências:

```bash
bun install
```

2. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

3. Preencha no `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Inicie em desenvolvimento:

```bash
bun run dev        # SPA
bun run dev:pwa    # PWA
```

## Build

```bash
bun run build:pwa
```

Saída em `dist/pwa`.

## Deploy na Vercel

1. Importe o repositório `CGB-ENERGIA/clientes`.
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. O `vercel.json` já define build PWA e pasta de saída.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `bun run dev` | Desenvolvimento SPA |
| `bun run dev:pwa` | Desenvolvimento PWA |
| `bun run build:pwa` | Build de produção PWA |
| `bun run setup` | Setup inicial do Supabase |
