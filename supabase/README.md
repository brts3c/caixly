# Supabase do Caixly

## Aplicação inicial

1. Crie um projeto Supabase na região mais próxima dos clientes.
2. No SQL Editor, execute `migrations/202607300001_caixly_core.sql`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Guarde `SUPABASE_SERVICE_ROLE_KEY` somente nos secrets do servidor.

## Definir o único dono do SaaS

Crie primeiro o usuário do dono em Authentication. Depois execute no SQL Editor,
substituindo o e-mail:

```sql
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = lower('SEU_EMAIL_AQUI')
on conflict (user_id) do nothing;
```

Não exponha `platform_admins` em formulários de equipe. Os papéis disponíveis
para empresas clientes são somente `admin`, `manager` e `cashier`.

## Segurança

- Todas as tabelas operacionais usam Row Level Security.
- Empresa e filial são derivadas da sessão autenticada, nunca aceitas como
  autorização apenas porque vieram da tela.
- Vendas finalizadas não podem ter valores reescritos.
- Cancelamentos e estornos exigem administrador ou gerente e um motivo.
- Documentos fiscais e assinaturas são gravados apenas pelo backend.
- A trilha de auditoria não possui políticas de alteração ou exclusão.
