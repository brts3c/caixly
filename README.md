# Caixly

Plataforma SaaS de PDV e gestão para pequenos negócios de varejo e alimentação.

## Recursos atuais

- Landing page comercial responsiva
- Frente de caixa com busca, categorias, carrinho e descontos
- Dashboard de vendas e exportação de relatórios
- Gestão de produtos e configurações da loja
- Estrutura multi-tenant para empresas e filiais
- Controle de acesso RBAC para Administrador, Gerente e Operador
- Painel interno exclusivo do dono do SaaS

## Executar localmente

Requer Node.js 22 ou superior.

```bash
pnpm install
pnpm dev
```

Para gerar a versão de produção:

```bash
pnpm build
```

## Segurança

O papel Super Admin pertence exclusivamente ao dono do Caixly e não pode ser
visualizado, criado ou atribuído por empresas clientes. Autorizações sensíveis
devem ser validadas no servidor e registradas em trilha de auditoria.

## Deploy na Cloudflare

O workflow `.github/workflows/deploy-cloudflare.yml` valida e publica a branch
`main` no Cloudflare Workers. Configure estes secrets no GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

O token deve ter somente as permissões necessárias para editar Workers na conta
que hospedará o Caixly. Nunca salve tokens no repositório.
