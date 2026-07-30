"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./lib/supabase";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  canAccessRoute,
  defaultRoute,
  type PlanCode,
  type TenantRole,
} from "./lib/access";

type Store = { id: string; tenant_id: string; name: string };
type ProductRow = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  name: string;
  category: string | null;
  sale_price: number | string;
  description: string;
  emoji: string;
  active: boolean;
};
type SaleRow = {
  id: string;
  store_id: string;
  operator_user_id: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  created_at: string;
};
type TenantRow = { id: string; trade_name: string; legal_name: string; status: string };
type SubscriptionRow = { tenant_id: string; plan_code: PlanCode; status: string };
type AuditRow = {
  id: number;
  tenant_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type PortalState = {
  loading: boolean;
  userId: string;
  email: string;
  displayName: string;
  platformOwner: boolean;
  role: TenantRole | null;
  tenant: TenantRow | null;
  stores: Store[];
  currentStoreId: string;
  plan: PlanCode;
  products: ProductRow[];
  sales: SaleRow[];
  tenants: TenantRow[];
  subscriptions: SubscriptionRow[];
  allStores: Store[];
  auditLogs: AuditRow[];
  refresh: () => Promise<void>;
  setCurrentStoreId: (id: string) => void;
};

const EMPTY: PortalState = {
  loading: true,
  userId: "",
  email: "",
  displayName: "",
  platformOwner: false,
  role: null,
  tenant: null,
  stores: [],
  currentStoreId: "",
  plan: "free",
  products: [],
  sales: [],
  tenants: [],
  subscriptions: [],
  allStores: [],
  auditLogs: [],
  refresh: async () => undefined,
  setCurrentStoreId: () => undefined,
};

const PortalContext = createContext<PortalState>(EMPTY);
const usePortal = () => useContext(PortalContext);
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
const notify = (message: string) => window.dispatchEvent(new CustomEvent("caixly-toast", { detail: message }));
const roleLabel = (role: TenantRole | null) =>
  role === "admin" ? "Administrador da empresa" :
  role === "manager" ? "Gerente / Supervisor" :
  role === "cashier" ? "Operador de Caixa" : "Sem empresa";

function Brand() {
  return <span className="logo" aria-label="Caixly"><span className="logo-mark"><b>C</b><i>✓</i></span><strong>Caixly</strong></span>;
}

function usePortalLoader() {
  const [state, setState] = useState<Omit<PortalState, "refresh" | "setCurrentStoreId">>(EMPTY);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setState({ ...EMPTY, loading: false });
      return;
    }

    const [{ data: profile }, { data: owner }, { data: membership }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("tenant_memberships").select("tenant_id,role").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
    ]);

    const displayName =
      profile?.full_name?.trim() ||
      String(user.user_metadata?.full_name || "").trim() ||
      user.email?.split("@")[0] ||
      "Usuário";

    if (owner) {
      const [{ data: tenants }, { data: subscriptions }, { data: allStores }, { data: auditLogs }] = await Promise.all([
        supabase.from("tenants").select("id,trade_name,legal_name,status").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("tenant_id,plan_code,status"),
        supabase.from("stores").select("id,tenant_id,name"),
        supabase.from("audit_logs").select("id,tenant_id,actor_user_id,action,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      setState({
        ...EMPTY,
        loading: false,
        userId: user.id,
        email: user.email || "",
        displayName,
        platformOwner: true,
        tenants: (tenants || []) as TenantRow[],
        subscriptions: (subscriptions || []) as SubscriptionRow[],
        allStores: (allStores || []) as Store[],
        auditLogs: (auditLogs || []) as AuditRow[],
      });
      return;
    }

    if (!membership) {
      setState({ ...EMPTY, loading: false, userId: user.id, email: user.email || "", displayName });
      return;
    }

    const tenantId = membership.tenant_id as string;
    const [{ data: tenant }, { data: stores }, { data: subscription }, { data: products }, { data: sales }] = await Promise.all([
      supabase.from("tenants").select("id,trade_name,legal_name,status").eq("id", tenantId).single(),
      supabase.from("stores").select("id,tenant_id,name").eq("tenant_id", tenantId).eq("active", true).order("created_at"),
      supabase.from("subscriptions").select("tenant_id,plan_code,status").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("products").select("id,tenant_id,store_id,name,category,sale_price,description,emoji,active").eq("tenant_id", tenantId).order("created_at"),
      supabase.from("sales").select("id,store_id,operator_user_id,status,subtotal,discount,total,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
    ]);
    const storeRows = (stores || []) as Store[];
    setState(previous => ({
      ...EMPTY,
      loading: false,
      userId: user.id,
      email: user.email || "",
      displayName,
      role: membership.role as TenantRole,
      tenant: tenant as TenantRow,
      stores: storeRows,
      currentStoreId: storeRows.some(store => store.id === previous.currentStoreId) ? previous.currentStoreId : (storeRows[0]?.id || ""),
      plan: ((subscription?.plan_code || "free") as PlanCode),
      products: (products || []) as ProductRow[],
      sales: (sales || []) as SaleRow[],
    }));
  }, []);

  // Initial synchronization with the authenticated Supabase session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const setCurrentStoreId = useCallback((currentStoreId: string) => {
    setState(previous => ({ ...previous, currentStoreId }));
  }, []);

  return { ...state, refresh, setCurrentStoreId };
}

export function SecurePortal({ path }: { path: string }) {
  const portal = usePortalLoader();

  useEffect(() => {
    if (portal.loading) return;
    if (!portal.userId) { navigate("/Login"); return; }
    if (portal.platformOwner) {
      if (path !== "/SaaSAdmin") navigate("/SaaSAdmin");
      return;
    }
    if (path === "/SaaSAdmin") {
      navigate(portal.role ? defaultRoute(portal.role) : "/Onboarding");
      return;
    }
    if (!portal.role) {
      if (path !== "/Onboarding") navigate("/Onboarding");
      return;
    }
    if (path === "/Onboarding" || !canAccessRoute(portal.role, path)) {
      navigate(defaultRoute(portal.role));
    }
  }, [path, portal.loading, portal.platformOwner, portal.role, portal.userId]);

  if (portal.loading) return <main className="auth-loading"><Brand/><span>Carregando seu acesso seguro...</span></main>;
  if (!portal.userId) return null;
  if (portal.platformOwner && path !== "/SaaSAdmin") return null;
  if (!portal.platformOwner && path === "/SaaSAdmin") return null;
  if (!portal.platformOwner && !portal.role && path !== "/Onboarding") return null;
  if (portal.role && (path === "/Onboarding" || !canAccessRoute(portal.role, path))) return null;

  return <PortalContext.Provider value={portal}>
    {path === "/SaaSAdmin" ? <OwnerPanel/> :
     path === "/Onboarding" ? <FirstSetup/> :
     path === "/PDV" ? <PointOfSale/> :
     path === "/Dashboard" || path === "/DashboardPremium" ? <Analytics/> :
     path === "/Produtos" || path === "/ProductsManagement" || path === "/ProdutosNovo" ? <Products/> :
     path === "/ConfiguracoesLoja" || path === "/Admin" ? <Settings/> :
     path === "/Equipe" ? <Team/> : <Home/>}
  </PortalContext.Provider>;
}

function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  const portal = usePortal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const allNav = [
    ["⌂", "Início", "/Home"],
    ["⊕", "Novo pedido", "/PDV"],
    ["▦", "Dashboard", "/Dashboard"],
    ["▤", "Produtos", "/Produtos"],
    ["♙", "Equipe e acessos", "/Equipe"],
    ["⚙", "Configurações", "/ConfiguracoesLoja"],
  ];
  const nav = allNav.filter(item => portal.role && canAccessRoute(portal.role, item[2]));
  const currentStore = portal.stores.find(store => store.id === portal.currentStoreId);
  const limit = PLAN_LIMITS[portal.plan];
  const percentage = limit ? Math.min(100, portal.products.length / limit * 100) : 100;
  const initials = portal.displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const logout = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    navigate("/Login");
  };

  return <div className="app-shell">
    <aside className={menuOpen ? "open" : ""}>
      <button className="brand-button" onClick={() => navigate(defaultRoute(portal.role!))}><Brand/></button>
      <nav>{nav.map(([icon, label, target]) =>
        <button key={target} className={active === label ? "active" : ""} onClick={() => { navigate(target); setMenuOpen(false); }}>
          <span>{icon}</span><span className="nav-copy"><b>{label}</b><small>{target === "/PDV" ? "Registrar vendas" : "Acesso conforme seu cargo"}</small></span>
        </button>
      )}</nav>
      <div className="side-bottom">
        {portal.role === "admin" && <div className="plan-mini">
          <small>PLANO {PLAN_LABELS[portal.plan].toUpperCase()}</small>
          <div><span><i style={{ width: `${percentage}%` }}/></span><b>{portal.products.length}/{limit ?? "∞"}</b></div>
          <em>produtos cadastrados</em>
        </div>}
        <div className="account-wrap">
          <button className="account" onClick={() => setProfileOpen(!profileOpen)}>
            <span>{initials || "U"}</span><div><b>{portal.displayName}</b><small>{roleLabel(portal.role)}</small></div><i>⋮</i>
          </button>
          {profileOpen && <div className="account-menu"><button onClick={logout}>↪ Sair do portal</button></div>}
        </div>
      </div>
    </aside>
    {menuOpen && <button className="aside-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}/>}
    <div className="app-content">
      <header className="app-top">
        <button className="menu" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="page-context"><button className="back-button" onClick={() => window.history.back()}>← Voltar</button><span>Caixly / <b>{active}</b></span></div>
        <div className="header-popover-wrap">
          <button className="store-select" onClick={() => setStoresOpen(!storesOpen)}><span>▣</span><div><small>FILIAL ATUAL</small><b>{currentStore?.name || "Configure sua filial"} <i>⌄</i></b></div></button>
          {storesOpen && <div className="header-popover store-popover"><b>Trocar de filial</b>{portal.stores.map(store =>
            <button key={store.id} className={store.id === portal.currentStoreId ? "selected" : ""} onClick={() => { portal.setCurrentStoreId(store.id); setStoresOpen(false); }}>✓ {store.name}</button>
          )}</div>}
        </div>
        <span className="online"><i/> Acesso protegido</span>
      </header>
      {children}
    </div>
  </div>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="portal-empty"><span>◇</span><h3>{title}</h3><p>{text}</p>{action && <button className="button primary" onClick={onAction}>{action}</button>}</div>;
}

function Home() {
  const portal = usePortal();
  const storeSales = portal.sales.filter(sale => !portal.currentStoreId || sale.store_id === portal.currentStoreId);
  const today = new Date().toDateString();
  const todaySales = storeSales.filter(sale => new Date(sale.created_at).toDateString() === today && sale.status === "paid");
  const revenue = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const ticket = todaySales.length ? revenue / todaySales.length : 0;
  return <Shell active="Início"><main className="dashboard-page">
    <div className="dash-head"><div><small>VISÃO GERAL</small><h1>Olá, {portal.displayName.split(" ")[0]} 👋</h1><p>Sua conta mostra somente os dados reais da sua empresa.</p></div><button className="button primary" onClick={() => navigate("/PDV")}>＋ Novo pedido</button></div>
    <div className="summary-grid three">
      <Metric title="Vendas hoje" value={money(revenue)}/>
      <Metric title="Pedidos hoje" value={String(todaySales.length)}/>
      <Metric title="Ticket médio" value={money(ticket)}/>
    </div>
    <section className="dash-card owner-tenants"><div className="card-title"><div><small>ATIVIDADE REAL</small><h3>Vendas recentes</h3></div></div>
      {storeSales.length ? <table><tbody>{storeSales.slice(0, 8).map(sale => <tr key={sale.id}><td><b>#{sale.id.slice(0, 8)}</b></td><td>{new Date(sale.created_at).toLocaleString("pt-BR")}</td><td>{sale.status}</td><td><b>{money(Number(sale.total))}</b></td></tr>)}</tbody></table> :
      <EmptyState title="Sua operação começa zerada" text="Cadastre produtos e registre a primeira venda. Nenhum dado de demonstração foi colocado nesta conta." action={portal.role === "cashier" ? "Abrir frente de caixa" : "Cadastrar primeiro produto"} onAction={() => navigate(portal.role === "cashier" ? "/PDV" : "/Produtos")}/>}
    </section>
  </main></Shell>;
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="summary"><small>{title}</small><strong>{value}</strong><div><span>Dados da sua conta</span></div></div>;
}

function PointOfSale() {
  const portal = usePortal();
  const products = portal.products.filter(product => product.active && (!product.store_id || product.store_id === portal.currentStoreId));
  const [cart, setCart] = useState<Array<ProductRow & { qty: number }>>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.sale_price) * item.qty, 0);
  const visible = products.filter(product => product.name.toLowerCase().includes(query.toLowerCase()));
  const add = (product: ProductRow) => setCart(previous => previous.some(item => item.id === product.id) ? previous.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item) : [...previous, { ...product, qty: 1 }]);
  const finish = async () => {
    if (!cart.length || !portal.tenant || !portal.currentStoreId) return;
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: sale, error } = await supabase.from("sales").insert({
      tenant_id: portal.tenant.id,
      store_id: portal.currentStoreId,
      operator_user_id: portal.userId,
      status: "open",
      subtotal,
      discount: 0,
      total: subtotal,
    }).select("id").single();
    if (error) { notify(error.message); setSaving(false); return; }
    const { error: itemError } = await supabase.from("sale_items").insert(cart.map(item => ({
      sale_id: sale.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.qty,
      unit_price: Number(item.sale_price),
      discount: 0,
      total: Number(item.sale_price) * item.qty,
    })));
    if (itemError) { notify(itemError.message); setSaving(false); return; }
    const { error: finishError } = await supabase.from("sales").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", sale.id);
    if (finishError) { notify(finishError.message); setSaving(false); return; }
    setCart([]);
    await portal.refresh();
    notify("Venda registrada com segurança.");
    setSaving(false);
  };
  return <Shell active="Novo pedido"><main className="pos-page">
    <section className="catalog"><div className="pos-head"><div><small>FRENTE DE CAIXA</small><h1>O que vamos vender?</h1></div><label className="search">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar produto..."/></label></div>
      <div className="product-grid">{visible.map(product => <button className="product-card" key={product.id} onClick={() => add(product)}><span>{product.emoji || "•"}</span><div><small>{product.category || "PRODUTO"}</small><h3>{product.name}</h3><p>{product.description}</p><footer><b>{money(Number(product.sale_price))}</b><i>＋</i></footer></div></button>)}</div>
      {!visible.length && <EmptyState title="Nenhum produto disponível" text="Um Administrador ou Gerente precisa cadastrar e ativar produtos para esta filial."/>}
    </section>
    <aside className="cart-panel"><div className="cart-title"><div><small>PEDIDO ATUAL</small><h2>Carrinho <span>{cart.reduce((sum, item) => sum + item.qty, 0)}</span></h2></div><button onClick={() => setCart([])}>Limpar</button></div>
      <div className="cart-items">{cart.length ? cart.map(item => <div className="cart-item" key={item.id}><span>{item.emoji}</span><div><b>{item.name}</b><small>{item.qty} × {money(Number(item.sale_price))}</small></div><strong>{money(Number(item.sale_price) * item.qty)}</strong></div>) : <div className="empty-cart"><span>🛒</span><b>Carrinho vazio</b><p>Escolha um produto para começar.</p></div>}</div>
      <div className="cart-total"><div className="grand"><span>Total</span><b>{money(subtotal)}</b></div><button className="button primary full" disabled={!cart.length || saving} onClick={finish}>{saving ? "Registrando..." : "Finalizar pedido →"}</button></div>
    </aside>
  </main></Shell>;
}

function Analytics() {
  const portal = usePortal();
  const sales = portal.sales.filter(sale => sale.status === "paid" && (!portal.currentStoreId || sale.store_id === portal.currentStoreId));
  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const exportCsv = () => {
    const rows = ["id,data,status,total", ...sales.map(sale => `${sale.id},${sale.created_at},${sale.status},${sale.total}`)];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "vendas-caixly.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return <Shell active="Dashboard"><main className="dashboard-page">
    <div className="dash-head"><div><small>RELATÓRIOS OPERACIONAIS</small><h1>Dashboard</h1><p>{portal.role === "admin" ? "Visão financeira da sua empresa." : "Visão operacional somente das filiais atribuídas."}</p></div>{sales.length > 0 && <button className="button outline" onClick={exportCsv}>Exportar CSV</button>}</div>
    <div className="summary-grid three"><Metric title={portal.role === "admin" ? "Receita" : "Vendas registradas"} value={portal.role === "admin" ? money(revenue) : String(sales.length)}/><Metric title="Pedidos" value={String(sales.length)}/><Metric title="Ticket médio" value={money(sales.length ? revenue / sales.length : 0)}/></div>
    <section className="dash-card order-table">{sales.length ? <table><thead><tr><th>Venda</th><th>Data</th><th>Status</th><th>Total</th></tr></thead><tbody>{sales.map(sale => <tr key={sale.id}><td>#{sale.id.slice(0, 8)}</td><td>{new Date(sale.created_at).toLocaleString("pt-BR")}</td><td>{sale.status}</td><td>{money(Number(sale.total))}</td></tr>)}</tbody></table> : <EmptyState title="Ainda não há vendas" text="Os relatórios serão preenchidos conforme a operação real acontecer."/>}</section>
  </main></Shell>;
}

function Products() {
  const portal = usePortal();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [adding, setAdding] = useState(false);
  const limit = PLAN_LIMITS[portal.plan];
  const atLimit = limit !== null && portal.products.length >= limit;
  const add = async () => {
    if (!name.trim() || !portal.tenant) return;
    const parsedPrice = Number(price.replace(",", "."));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { notify("Informe um preço válido."); return; }
    const { error } = await getSupabaseBrowserClient().from("products").insert({
      tenant_id: portal.tenant.id,
      store_id: portal.currentStoreId || null,
      name: name.trim(),
      category: "Geral",
      sale_price: parsedPrice,
      description: "",
      emoji: "•",
      active: true,
    });
    if (error) { notify(error.message); return; }
    setName(""); setPrice("0"); setAdding(false); await portal.refresh(); notify("Produto cadastrado.");
  };
  const toggle = async (product: ProductRow) => {
    const { error } = await getSupabaseBrowserClient().from("products").update({ active: !product.active }).eq("id", product.id);
    if (error) { notify(error.message); return; }
    await portal.refresh();
  };
  return <Shell active="Produtos"><main className="dashboard-page">
    <div className="dash-head"><div><small>CATÁLOGO REAL</small><h1>Produtos</h1><p>{portal.products.length} de {limit ?? "ilimitados"} produtos no plano {PLAN_LABELS[portal.plan]}.</p></div><button className="button primary" disabled={portal.role !== "admin" || atLimit} onClick={() => setAdding(!adding)}>＋ Adicionar produto</button></div>
    {atLimit && <div className="auth-feedback">O limite do plano {PLAN_LABELS[portal.plan]} foi atingido. O banco bloqueia novos produtos até a troca de plano.</div>}
    {adding && <section className="dash-card inline-product-form"><label>Nome<input value={name} onChange={event => setName(event.target.value)}/></label><label>Preço<input type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)}/></label><button className="button primary" onClick={add}>Salvar produto</button></section>}
    <section className="dash-card product-table">{portal.products.length ? <table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead><tbody>{portal.products.map(product => <tr key={product.id}><td><b>{product.name}</b></td><td>{product.category || "Geral"}</td><td>{money(Number(product.sale_price))}</td><td>{product.active ? "Ativo" : "Inativo"}</td><td><button className="row-action" onClick={() => toggle(product)}>{product.active ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table> : <EmptyState title="Catálogo vazio" text="Toda conta nova começa sem produtos. Cadastre o primeiro para liberar a frente de caixa."/>}</section>
  </main></Shell>;
}

function Settings() {
  const portal = usePortal();
  const [businessName, setBusinessName] = useState(portal.tenant?.trade_name || "");
  const [storeName, setStoreName] = useState(portal.stores.find(store => store.id === portal.currentStoreId)?.name || "");
  const save = async () => {
    const supabase = getSupabaseBrowserClient();
    const results = await Promise.all([
      supabase.from("tenants").update({ trade_name: businessName.trim(), legal_name: businessName.trim() }).eq("id", portal.tenant!.id),
      supabase.from("stores").update({ name: storeName.trim() }).eq("id", portal.currentStoreId),
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) { notify(error.message); return; }
    await portal.refresh(); notify("Configurações salvas.");
  };
  const limit = PLAN_LIMITS[portal.plan];
  return <Shell active="Configurações"><main className="dashboard-page settings">
    <div className="dash-head"><div><small>CONFIGURAÇÃO DA CONTA</small><h1>Sua empresa</h1><p>Esses dados foram informados no seu cadastro, sem conteúdo demonstrativo.</p></div></div>
    <section className="dash-card settings-form"><div className="form-grid"><label>Nome da empresa<input value={businessName} onChange={event => setBusinessName(event.target.value)}/></label><label>Filial atual<input value={storeName} onChange={event => setStoreName(event.target.value)}/></label></div><div className="subscription-box"><span>PLANO {PLAN_LABELS[portal.plan].toUpperCase()}</span><b>{limit === null ? "Produtos ilimitados" : `Até ${limit} produtos`}</b><p>O limite também é validado no banco de dados.</p></div><button className="button primary" onClick={save}>Salvar alterações</button></section>
  </main></Shell>;
}

function Team() {
  const portal = usePortal();
  const roles = [
    ["Administrador", "Todas as lojas, relatórios financeiros, preços, configurações e equipe."],
    ["Gerente / Supervisor", "Somente filiais atribuídas, estoque, caixa e relatórios operacionais."],
    ["Operador de Caixa", "Somente a frente de caixa e as próprias vendas."],
  ];
  return <Shell active="Equipe e acessos"><main className="dashboard-page access-page">
    <div className="dash-head"><div><small>RBAC ATIVO</small><h1>Equipe e acessos</h1><p>Seu acesso atual: <b>{roleLabel(portal.role)}</b>.</p></div></div>
    <div className="security-banner"><span>◈</span><div><b>Super Admin é exclusivo do dono do Caixly</b><p>Este papel não aparece nem pode ser atribuído por contas de clientes.</p></div></div>
    <div className="role-cards tenant-role-cards">{roles.map(([name, description], index) => <div className={`role-summary-card ${index === 0 ? "green" : index === 1 ? "orange" : "blue"}`} key={name}><b>{name}</b><p>{description}</p></div>)}</div>
    <section className="dash-card matrix-card"><div className="card-title"><div><small>MATRIZ APLICADA</small><h3>Permissões críticas por papel</h3></div></div><div className="matrix-scroll"><table><thead><tr><th>Ação</th><th>Administrador</th><th>Gerente</th><th>Operador</th></tr></thead><tbody>{[
      ["Ver lucro e custos", "Todas as lojas", "Não", "Não"],
      ["Alterar preços", "Sim", "Não", "Não"],
      ["Ajustar estoque", "Todas as lojas", "Filial atribuída", "Não"],
      ["Aplicar desconto", "Define política", "Aprova", "Dentro do limite"],
      ["Cancelar venda fiscal", "Auditado", "Com motivo", "Não"],
      ["Fechar caixa", "Qualquer filial", "Filial atribuída", "Não"],
      ["Gerenciar usuários", "Equipe da empresa", "Operadores da filial", "Não"],
    ].map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={cell}>{index === 0 ? <b>{cell}</b> : cell}</td>)}</tr>)}</tbody></table></div></section>
  </main></Shell>;
}

function OwnerPanel() {
  const portal = usePortal();
  const [section, setSection] = useState<"overview" | "companies" | "subscriptions" | "plans" | "audit">("overview");
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState<TenantRow | null>(null);
  const [managedPlan, setManagedPlan] = useState<PlanCode>("free");
  const [managedStatus, setManagedStatus] = useState("trial");
  const [saving, setSaving] = useState(false);
  const active = portal.tenants.filter(tenant => tenant.status === "active" || tenant.status === "trial").length;
  const pastDue = portal.tenants.filter(tenant => tenant.status === "past_due" || tenant.status === "blocked").length;
  const prices: Record<PlanCode, number> = { free: 0, essential: 49.9, professional: 79.9, unlimited: 119.9 };
  const planOf = (tenantId: string): PlanCode =>
    portal.subscriptions.find(item => item.tenant_id === tenantId)?.plan_code || "free";
  const statusLabel = (status: string) => ({
    trial: "Em teste", active: "Ativa", past_due: "Inadimplente", blocked: "Bloqueada",
    cancelled: "Cancelada", trialing: "Em teste", canceled: "Cancelada",
  }[status] || status);
  const monthlyRevenue = portal.tenants.reduce((total, tenant) =>
    tenant.status === "active" || tenant.status === "trial" ? total + prices[planOf(tenant.id)] : total, 0);
  const visibleTenants = portal.tenants.filter(tenant =>
    `${tenant.trade_name} ${tenant.legal_name}`.toLowerCase().includes(query.toLowerCase()));
  const openManager = (tenant: TenantRow) => {
    setManaging(tenant);
    setManagedPlan(planOf(tenant.id));
    setManagedStatus(tenant.status);
  };
  const saveTenant = async () => {
    if (!managing) return;
    setSaving(true);
    const { error } = await getSupabaseBrowserClient().rpc("platform_manage_tenant", {
      target_tenant: managing.id,
      new_status: managedStatus,
      new_plan_code: managedPlan,
    });
    if (error) {
      notify(error.message);
      setSaving(false);
      return;
    }
    await portal.refresh();
    setSaving(false);
    setManaging(null);
    notify("Empresa atualizada e ação registrada na auditoria.");
  };
  const logout = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    navigate("/Login");
  };
  const navItems = [
    ["overview", "◆", "Visão global"],
    ["companies", "▦", "Empresas"],
    ["subscriptions", "◈", "Assinaturas"],
    ["plans", "◇", "Planos"],
    ["audit", "◎", "Auditoria"],
  ] as const;
  const titles = {
    overview: ["Visão global do Caixly", "Acompanhe clientes, receita estimada e pendências da plataforma."],
    companies: ["Empresas clientes", "Gerencie o plano e o acesso de cada empresa com segurança."],
    subscriptions: ["Assinaturas", "Controle o plano comercial e o estado de cada assinatura."],
    plans: ["Planos do Caixly", "Regras comerciais e limites aplicados no banco de dados."],
    audit: ["Auditoria da plataforma", "Histórico das ações administrativas realizadas no SaaS."],
  };
  const tenantTable = (rows: TenantRow[]) => rows.length ? <div className="owner-table-wrap"><table>
    <thead><tr><th>Empresa</th><th>Plano</th><th>Lojas</th><th>Status</th><th></th></tr></thead>
    <tbody>{rows.map(tenant => {
      const subscription = portal.subscriptions.find(item => item.tenant_id === tenant.id);
      const stores = portal.allStores.filter(store => store.tenant_id === tenant.id).length;
      return <tr key={tenant.id}>
        <td><b>{tenant.trade_name}</b><small>{tenant.legal_name}</small></td>
        <td>{PLAN_LABELS[subscription?.plan_code || "free"]}</td>
        <td>{stores}</td>
        <td><span className={`owner-status ${tenant.status}`}>{statusLabel(tenant.status)}</span></td>
        <td><button className="owner-action" onClick={() => openManager(tenant)}>Gerenciar →</button></td>
      </tr>;
    })}</tbody>
  </table></div> : <EmptyState title="Nenhum cliente encontrado" text="As empresas aparecerão aqui após concluírem a configuração inicial."/>;

  return <div className="saas-owner">
    <aside>
      <button className="owner-brand" onClick={() => setSection("overview")}><Brand/></button>
      <span>PAINEL INTERNO</span>
      <nav>{navItems.map(([key, icon, label]) =>
        <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
          <i>{icon}</i><b>{label}</b>
        </button>)}</nav>
      <div className="owner-account"><small>ACESSO EXCLUSIVO</small><b>{portal.email}</b><p>Este papel não pode ser delegado.</p><button onClick={logout}>Sair da conta</button></div>
    </aside>
    <main>
      <div className="owner-topbar">
        <button className="owner-back" onClick={() => navigate("/")}>← Voltar ao site</button>
        <div><button onClick={() => void portal.refresh()}>↻ Atualizar</button><span className="owner-lock">🔒 Super Admin exclusivo</span></div>
      </div>
      <header><div><small>PAINEL DO FUNDADOR</small><h1>{titles[section][0]}</h1><p>{titles[section][1]}</p></div></header>

      {section === "overview" && <>
        <div className="owner-metrics"><Metric title="Empresas" value={String(portal.tenants.length)}/><Metric title="Ativas / teste" value={String(active)}/><Metric title="Com pendência" value={String(pastDue)}/><Metric title="MRR estimado" value={money(monthlyRevenue)}/></div>
        <div className="owner-quick-grid">
          <button onClick={() => setSection("companies")}><span>▦</span><div><b>Gerenciar empresas</b><small>Planos, bloqueios e acesso</small></div><i>→</i></button>
          <button onClick={() => setSection("subscriptions")}><span>◈</span><div><b>Ver assinaturas</b><small>Receita e situação comercial</small></div><i>→</i></button>
          <button onClick={() => setSection("audit")}><span>◎</span><div><b>Abrir auditoria</b><small>Histórico administrativo</small></div><i>→</i></button>
        </div>
        <section className="dash-card owner-tenants"><div className="card-title"><div><small>CLIENTES DO SAAS</small><h3>Empresas recentes</h3></div><button className="owner-link" onClick={() => setSection("companies")}>Ver todas →</button></div>{tenantTable(portal.tenants.slice(0, 8))}</section>
      </>}

      {section === "companies" && <section className="dash-card owner-tenants owner-section-card">
        <div className="owner-toolbar"><div><small>CLIENTES DO SAAS</small><h3>{visibleTenants.length} empresas</h3></div><input aria-label="Buscar empresa" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome da empresa..."/></div>
        {tenantTable(visibleTenants)}
      </section>}

      {section === "subscriptions" && <section className="dash-card owner-tenants owner-section-card">
        <div className="card-title"><div><small>CONTROLE COMERCIAL</small><h3>Assinaturas ativas e pendentes</h3></div></div>
        {portal.tenants.length ? <div className="owner-table-wrap"><table><thead><tr><th>Empresa</th><th>Plano</th><th>Situação</th><th>Valor estimado</th><th></th></tr></thead><tbody>
          {portal.tenants.map(tenant => {
            const subscription = portal.subscriptions.find(item => item.tenant_id === tenant.id);
            const plan = subscription?.plan_code || "free";
            return <tr key={tenant.id}><td><b>{tenant.trade_name}</b></td><td>{PLAN_LABELS[plan]}</td><td>{statusLabel(subscription?.status || tenant.status)}</td><td><b>{money(prices[plan])}</b><small>/mês</small></td><td><button className="owner-action" onClick={() => openManager(tenant)}>Alterar →</button></td></tr>;
          })}
        </tbody></table></div> : <EmptyState title="Nenhuma assinatura" text="As assinaturas são criadas junto com cada nova empresa."/>}
      </section>}

      {section === "plans" && <div className="owner-plan-grid">
        {(["free", "essential", "professional", "unlimited"] as PlanCode[]).map(plan => <section key={plan} className={`owner-plan-card ${plan === "professional" ? "featured" : ""}`}>
          {plan === "professional" && <em>MAIS POPULAR</em>}<small>PLANO</small><h2>{PLAN_LABELS[plan]}</h2><b>{prices[plan] ? money(prices[plan]) : "Grátis"}{prices[plan] > 0 && <i>/mês</i>}</b>
          <ul><li>{PLAN_LIMITS[plan] === null ? "Produtos ilimitados" : `Até ${PLAN_LIMITS[plan]} produtos`}</li><li>Usuários e lojas com RBAC</li><li>Dados isolados por empresa</li></ul>
          <button onClick={() => { setQuery(""); setSection("companies"); }}>Gerenciar clientes →</button>
        </section>)}
      </div>}

      {section === "audit" && <section className="dash-card owner-section-card">
        <div className="card-title"><div><small>SEGURANÇA</small><h3>Últimos 100 eventos</h3></div></div>
        {portal.auditLogs.length ? <div className="owner-audit-list">{portal.auditLogs.map(log => {
          const tenant = portal.tenants.find(item => item.id === log.tenant_id);
          return <article key={log.id}><span>◎</span><div><b>{log.action}</b><p>{tenant?.trade_name || "Plataforma"} · {log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}</p></div><time>{new Date(log.created_at).toLocaleString("pt-BR")}</time></article>;
        })}</div> : <EmptyState title="Nenhum evento registrado" text="As ações administrativas futuras aparecerão aqui."/>}
      </section>}
    </main>

    {managing && <div className="owner-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setManaging(null); }}>
      <section className="owner-modal" role="dialog" aria-modal="true" aria-labelledby="manage-company-title">
        <button className="owner-modal-close" aria-label="Fechar" onClick={() => setManaging(null)}>×</button>
        <small>ADMINISTRAÇÃO DA EMPRESA</small><h2 id="manage-company-title">{managing.trade_name}</h2><p>{managing.legal_name}</p>
        <label>Plano<select value={managedPlan} onChange={event => setManagedPlan(event.target.value as PlanCode)}><option value="free">Gratuito · 5 produtos</option><option value="essential">Essential · 15 produtos</option><option value="professional">Professional · 30 produtos</option><option value="unlimited">Ilimitado · tudo liberado</option></select></label>
        <label>Status de acesso<select value={managedStatus} onChange={event => setManagedStatus(event.target.value)}><option value="trial">Em teste</option><option value="active">Ativa</option><option value="past_due">Inadimplente</option><option value="blocked">Bloqueada</option><option value="cancelled">Cancelada</option></select></label>
        {(managedStatus === "blocked" || managedStatus === "cancelled") && <div className="owner-danger-note">A empresa perderá o acesso ao sistema. A alteração ficará registrada na auditoria.</div>}
        <div className="owner-modal-actions"><button className="owner-cancel" onClick={() => setManaging(null)}>Cancelar</button><button className="owner-save" disabled={saving} onClick={saveTenant}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
      </section>
    </div>}
  </div>;
}

function FirstSetup() {
  const portal = usePortal();
  const [businessName, setBusinessName] = useState("");
  const [storeName, setStoreName] = useState("Loja principal");
  const [saving, setSaving] = useState(false);
  const create = async () => {
    if (!businessName.trim()) { notify("Informe o nome da empresa."); return; }
    setSaving(true);
    const { error } = await getSupabaseBrowserClient().rpc("create_tenant_with_owner", {
      company_legal_name: businessName.trim(),
      company_trade_name: businessName.trim(),
      first_store_name: storeName.trim() || "Loja principal",
    });
    if (error) { notify(error.message); setSaving(false); return; }
    await portal.refresh();
    navigate("/Home");
  };
  return <main className="onboarding"><header><Brand/><button className="onboard-exit" onClick={async () => { await getSupabaseBrowserClient().auth.signOut(); navigate("/Login"); }}>Sair</button></header><div className="onboard-wrap"><section><small>CONFIGURAÇÃO INICIAL</small><h1>Prepare sua conta<br/>do zero.</h1><p>Nenhum produto, venda ou dado de demonstração será adicionado.</p><div className="onboard-form"><label>Nome da empresa<input autoFocus value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Ex.: Minha Loja"/></label><label>Nome da primeira filial<input value={storeName} onChange={event => setStoreName(event.target.value)}/></label><button className="button primary full" disabled={saving} onClick={create}>{saving ? "Criando..." : "Criar empresa no plano Gratuito →"}</button></div></section></div></main>;
}
