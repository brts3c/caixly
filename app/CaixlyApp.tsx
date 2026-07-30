"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  emoji: string;
  description: string;
  active?: boolean;
};

type CartItem = Product & { qty: number; note?: string };

const PRODUCTS: Product[] = [
  { id: 1, name: "Açaí Clássico", category: "Açaí", price: 18.9, emoji: "🥣", description: "Açaí cremoso, banana e granola" },
  { id: 2, name: "Açaí Energia", category: "Açaí", price: 23.9, emoji: "⚡", description: "Açaí, morango, leite em pó e paçoca" },
  { id: 3, name: "Smash Bacon", category: "Lanches", price: 27.9, emoji: "🍔", description: "Carne 120g, cheddar, bacon e molho da casa" },
  { id: 4, name: "X-Salada", category: "Lanches", price: 22.5, emoji: "🥪", description: "Carne, queijo, salada fresca e maionese" },
  { id: 5, name: "Batata Crocante", category: "Acompanhamentos", price: 14.9, emoji: "🍟", description: "Porção individual com páprica" },
  { id: 6, name: "Coca-Cola", category: "Bebidas", price: 7.5, emoji: "🥤", description: "Lata 350 ml, gelada" },
  { id: 7, name: "Suco de Laranja", category: "Bebidas", price: 10.9, emoji: "🍊", description: "Natural, copo 400 ml" },
  { id: 8, name: "Brownie", category: "Doces", price: 9.9, emoji: "🍫", description: "Chocolate intenso com castanhas" },
];

const ORDERS = [
  { no: "#1048", time: "14:32", items: "2 itens", total: 42.8, status: "Finalizado" },
  { no: "#1047", time: "14:18", items: "3 itens", total: 58.3, status: "Finalizado" },
  { no: "#1046", time: "13:55", items: "1 item", total: 23.9, status: "Finalizado" },
  { no: "#1045", time: "13:41", items: "4 itens", total: 76.6, status: "Finalizado" },
];

const SEGMENTS = [
  ["🥣", "Açaíterias", "/sistema-pdv-para-acaiteria"],
  ["🍦", "Sorveterias", "/sistema-para-sorveteria"],
  ["🚚", "Food trucks", "/pdv-para-food-truck"],
  ["🍔", "Hamburguerias", "/sistema-pdv-para-hamburgueria"],
  ["🥖", "Padarias", "/sistema-para-padaria"],
  ["🥪", "Lanchonetes", "/sistema-para-lanchonete"],
];

const ROLES = [
  {
    id: "super_admin",
    icon: "◆",
    name: "Super Admin",
    subtitle: "Dono do SaaS",
    color: "violet",
    scope: "Toda a plataforma, empresas e lojas. Dados operacionais de clientes somente por suporte autorizado e auditado.",
    create: "Planos, contas empresariais, integrações globais e usuários internos do SaaS.",
    read: "Métricas globais, assinaturas, disponibilidade, auditoria e faturamento agregado da plataforma.",
    update: "Planos, limites, status da assinatura, configurações globais e bloqueio por inadimplência.",
    remove: "Desativar tenants e usuários internos com retenção legal; exclusão definitiva somente por processo LGPD.",
    restrictions: "Nunca visualizar dados completos de cartão, senhas ou chaves. Não alterar vendas, caixa, estoque ou documentos fiscais do cliente sem autorização registrada. Toda impersonação exige motivo, prazo e trilha de auditoria.",
  },
  {
    id: "owner",
    icon: "♛",
    name: "Administrador",
    subtitle: "Dono da empresa cliente",
    color: "green",
    scope: "Todas as lojas e filiais do próprio tenant. Pode consolidar dados e alternar entre unidades.",
    create: "Lojas, produtos, fornecedores, usuários, perfis internos, movimentações e configurações fiscais.",
    read: "Vendas, lucro, custos, estoque, notas fiscais, fechamento, contas e relatórios de todas as suas filiais.",
    update: "Preços, estoque, permissões inferiores, dados da empresa e políticas de desconto e caixa.",
    remove: "Inativar produtos, usuários e cadastros. Vendas e documentos fiscais apenas por estorno/cancelamento legal auditado.",
    restrictions: "Sem acesso a outros tenants ou ao painel do SaaS. Não pode promover usuários a Super Admin, apagar trilhas de auditoria, editar vendas liquidadas ou reescrever documentos fiscais emitidos.",
  },
  {
    id: "manager",
    icon: "★",
    name: "Gerente / Supervisor",
    subtitle: "Responsável pela filial",
    color: "orange",
    scope: "Somente as filiais atribuídas. Visão operacional da equipe, estoque e caixas dessas unidades.",
    create: "Ajustes de estoque, sangrias, suprimentos, contagens, aprovações e fechamentos de caixa.",
    read: "Vendas e estoque da filial, divergências, turnos, operadores e relatórios operacionais autorizados.",
    update: "Estoque da filial, disponibilidade de produtos e descontos mediante limite ou aprovação registrada.",
    remove: "Cancelar vendas e cupons dentro da janela legal, sempre com motivo, credencial e evento de auditoria.",
    restrictions: "Não vê lucro consolidado, custos sensíveis, repasses bancários ou outras filiais. Não altera plano, dados fiscais da empresa, preço-base sem delegação nem cria administradores.",
  },
  {
    id: "cashier",
    icon: "▣",
    name: "Operador de Caixa",
    subtitle: "Frente de caixa",
    color: "blue",
    scope: "Terminal, loja e turno atribuídos. Visualiza apenas o necessário para registrar vendas.",
    create: "Abertura de caixa, pedidos, vendas, recebimentos e emissão do cupom fiscal.",
    read: "Cardápio, preço vigente, disponibilidade e resumo do próprio caixa e turno.",
    update: "Carrinho ainda aberto, quantidade, cliente e forma de pagamento antes da finalização.",
    remove: "Remover item do carrinho antes do pagamento, mantendo registro quando a política exigir.",
    restrictions: "Não acessa lucro, custos, relatórios gerenciais, outras lojas ou turnos. Não altera preços ou estoque, concede desconto acima do limite, cancela venda concluída, faz sangria ou fecha caixa sem autorização.",
  },
];

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function notify(message: string) {
  window.dispatchEvent(new CustomEvent("caixly-toast", { detail: message }));
}

function ToastLayer() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 2600);
    };
    window.addEventListener("caixly-toast", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("caixly-toast", show);
    };
  }, []);
  return message ? <div className="toast-message">✓ {message}</div> : null;
}

function Logo({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <span className="logo" aria-label="Caixly">
      <span className="logo-mark"><b>C</b><i>✓</i></span>
      {!iconOnly && <strong>Caixly</strong>}
    </span>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon">{children}</span>;
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function PublicHeader() {
  return (
    <header className="public-header">
      <button className="brand-button" onClick={() => navigate("/LandingPage")}><Logo /></button>
      <nav className="desktop-nav">
        <a href="#recursos">Recursos</a>
        <a href="#segmentos">Segmentos</a>
        <a href="#planos">Planos</a>
      </nav>
      <button className="button ghost compact" onClick={() => navigate("/CheckIn")}>Entrar <span>→</span></button>
    </header>
  );
}

function Landing() {
  return (
    <main className="landing">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <PublicHeader />

      <section className="hero">
        <div className="eyebrow"><span className="live-dot" /> Feito para quem faz acontecer</div>
        <h1>Seu negócio no ritmo<br />que ele <span>merece.</span></h1>
        <p>O PDV online que organiza pedidos, produtos e resultados sem complicação. Você atende melhor. O Caixly cuida do resto.</p>
        <div className="hero-actions">
          <button className="button primary large" onClick={() => navigate("/CheckIn")}>Começar gratuitamente <span>→</span></button>
          <a className="text-link" href="#produto">Ver como funciona <span>↓</span></a>
        </div>
        <div className="trust-row">
          <span>✓ Sem cartão de crédito</span><span>✓ Pronto em 2 minutos</span><span>✓ Cancele quando quiser</span>
        </div>
      </section>

      <section className="product-stage" id="produto">
        <div className="stage-glow" />
        <div className="app-preview">
          <div className="preview-sidebar">
            <Logo iconOnly />
            {["⌂", "⊞", "▥", "◫"].map((x, i) => <span className={i === 0 ? "active" : ""} key={x}>{x}</span>)}
          </div>
          <div className="preview-main">
            <div className="preview-top"><div><small>VISÃO GERAL</small><h3>Boa tarde, Mariana 👋</h3></div><span className="avatar">MS</span></div>
            <div className="preview-stats">
              <div><span>Vendas hoje</span><b>R$ 1.284,50</b><em>↗ 18% esta semana</em></div>
              <div><span>Pedidos</span><b>42</b><em>Ticket médio R$ 30,58</em></div>
              <div><span>Mais vendido</span><b>Açaí Energia</b><em>14 unidades</em></div>
            </div>
            <div className="preview-bottom">
              <div className="mock-chart"><div className="chart-title"><b>Vendas da semana</b><span>Últimos 7 dias⌄</span></div><div className="bars">{[38,52,45,72,64,88,76].map((h,i)=><i key={i} style={{height:`${h}%`}} />)}</div><div className="days"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div></div>
              <div className="mock-orders"><div className="chart-title"><b>Últimos pedidos</b><span>Ver todos</span></div>{ORDERS.slice(0,3).map(o=><div key={o.no}><span>{o.no}<small>{o.time}</small></span><b>{money(o.total)}</b></div>)}</div>
            </div>
          </div>
        </div>
        <div className="floating-pill pill-one"><span>✓</span><div><b>Pedido finalizado</b><small>#1048 • R$ 42,80</small></div></div>
        <div className="floating-pill pill-two"><span>↗</span><div><b>+18% em vendas</b><small>comparado à semana passada</small></div></div>
      </section>

      <section className="social-strip"><span>MAIS DE 2.000 NEGÓCIOS JÁ VENDEM MELHOR COM O CAIXLY</span><div>{["Bosque Açaí","Santo Smash","DOCE FRIO","pão & prosa","DONA NINA"].map(x=><b key={x}>{x}</b>)}</div></section>

      <section className="section" id="segmentos">
        <div className="section-heading"><div><small>PARA O SEU NEGÓCIO</small><h2>Do primeiro pedido ao<br /><span>último fechamento.</span></h2></div><p>Uma experiência pensada para a realidade de quem vende todos os dias — rápida, intuitiva e sem burocracia.</p></div>
        <div className="segment-grid">
          {SEGMENTS.map(([emoji, name, path]) => <button key={name} onClick={()=>navigate(path)}><span>{emoji}</span><b>{name}</b><small>Conhecer solução →</small></button>)}
        </div>
      </section>

      <section className="section feature-section" id="recursos">
        <div className="feature-copy"><small>MENOS PLANILHA. MAIS CONTROLE.</small><h2>Tudo o que você precisa.<br /><span>Nada que complique.</span></h2><p>Do balcão ao relatório, cada detalhe foi desenhado para tornar sua operação mais leve.</p>
          {[["⚡","Atendimento sem filas","Lance pedidos em poucos toques."],["📦","Produtos organizados","Cardápio e adicionais sempre em ordem."],["◔","Números que fazem sentido","Entenda o que vende e quando vende."]].map(([i,t,d])=><div className="feature-line" key={t}><Icon>{i}</Icon><div><b>{t}</b><span>{d}</span></div></div>)}
        </div>
        <div className="phone-wrap">
          <div className="phone"><div className="phone-top"><Logo /><span>•••</span></div><small>NOVO PEDIDO</small><h3>O que vamos vender?</h3><div className="chips"><span className="active">Todos</span><span>Açaí</span><span>Lanches</span></div>{PRODUCTS.slice(0,4).map(p=><div className="phone-product" key={p.id}><span>{p.emoji}</span><div><b>{p.name}</b><small>{money(p.price)}</small></div><i>+</i></div>)}<button onClick={()=>navigate("/PDV")}>Ver carrinho • R$ 42,80</button></div>
          <div className="float-card"><span>💡</span><div><small>INSIGHT DO DIA</small><b>Sexta é seu melhor dia</b><em>Você vende 24% mais</em></div></div>
        </div>
      </section>

      <section className="section pricing" id="planos">
        <div className="center-heading"><small>PLANOS QUE CRESCEM COM VOCÊ</small><h2>Comece grátis. Evolua <span>no seu tempo.</span></h2><p>Sem taxa de adesão, sem letras miúdas.</p></div>
        <div className="price-grid">
          {[
            ["Gratuito","R$ 0","Para começar hoje",["Até 5 produtos","PDV completo","Dashboard básico"]],
            ["Essencial","R$ 49,90","Para organizar a rotina",["Até 15 produtos","Relatórios e histórico","Exportação de dados"]],
            ["Profissional","R$ 79,90","Para crescer com controle",["Até 30 produtos","Gráficos avançados","Suporte prioritário"]],
            ["Premium","R$ 119,90","Para ir mais longe",["Produtos ilimitados","Insights inteligentes","Personalização completa"]],
          ].map(([name,price,desc,features],i)=><div className={`price-card ${i===2?"featured":""}`} key={name as string}>{i===2&&<span className="popular">MAIS ESCOLHIDO</span>}<h3>{name as string}</h3><p>{desc as string}</p><b>{price as string}<small>{i===0?"":"/mês"}</small></b><ul>{(features as string[]).map(f=><li key={f}>✓ {f}</li>)}</ul><button className={`button ${i===2?"primary":"outline"}`} onClick={()=>navigate("/CheckIn")}>{i===0?"Começar grátis":"Escolher plano"}</button></div>)}
        </div>
      </section>

      <section className="final-cta"><div><small>SEU NEGÓCIO MERECE ESSA TRANQUILIDADE</small><h2>Organize hoje.<br /><span>Cresça amanhã.</span></h2><p>Junte-se a milhares de empreendedores que já transformaram a rotina com o Caixly.</p><button className="button light large" onClick={()=>navigate("/CheckIn")}>Criar minha conta grátis →</button></div><div className="cta-rings"><Logo iconOnly /></div></section>
      <Footer />
    </main>
  );
}

function Footer() {
  return <footer><Logo /><p>Seu negócio mais simples, todos os dias.</p><div><button onClick={()=>navigate("/LandingPage")}>Produto</button><button onClick={()=>navigate("/funcionalidades")}>Funcionalidades</button><button onClick={()=>navigate("/precos")}>Planos</button><button onClick={()=>navigate("/sobre")}>Sobre</button><button onClick={()=>navigate("/privacidade")}>Privacidade</button><button onClick={()=>navigate("/termos")}>Termos</button></div><small>© 2026 Caixly. Feito com cuidado no Brasil.</small></footer>;
}

function CheckIn() {
  return <main className="auth-page"><div className="auth-visual"><Logo /><div><span className="quote">“</span><h1>Agora eu sei o que vende,<br />quanto vende e <em>quando.</em></h1><p>O Caixly tirou meu negócio do caderno e me deu tempo para cuidar do que importa.</p><div className="person"><span>MC</span><div><b>Mariana Costa</b><small>Bosque Açaí • Guarulhos, SP</small></div></div></div><small>Mais de 2.000 negócios conectados</small></div><div className="auth-form"><div><button className="back" onClick={()=>navigate("/LandingPage")}>← Voltar</button><small>BEM-VINDO AO CAIXLY</small><h2>Entre na sua conta</h2><p>Acesse seu PDV e continue vendendo.</p><label>E-mail<input defaultValue="demo@caixly.com.br" type="email" /></label><label>Senha<input defaultValue="123456" type="password" /></label><div className="form-row"><label className="check"><input type="checkbox" defaultChecked /> Lembrar de mim</label><button className="link-button" onClick={()=>notify("Enviamos as instruções para o e-mail de demonstração.")}>Esqueci minha senha</button></div><button className="button primary full" onClick={()=>navigate("/Home")}>Entrar na minha conta →</button><div className="divider"><span /> ou <span /></div><button className="button google full" onClick={()=>{notify("Login de demonstração realizado.");navigate("/Home")}}><b>G</b> Continuar com Google</button><p className="signup">Ainda não tem conta? <button onClick={()=>navigate("/Onboarding")}>Comece grátis</button></p></div></div></main>;
}

function AppShell({ active, children }: { active: string; children: React.ReactNode }) {
  const [open,setOpen]=useState(false);
  return <div className="app-shell"><aside className={open?"open":""}><button className="brand-button" onClick={()=>navigate("/Home")}><Logo /></button><nav>{[["⌂","Início","/Home"],["⊕","Novo pedido","/PDV"],["▦","Dashboard","/Dashboard"],["▤","Produtos","/Produtos"],["♙","Equipe e acessos","/Equipe"],["⚙","Configurações","/ConfiguracoesLoja"]].map(([i,n,p])=><button className={active===n?"active":""} key={n} onClick={()=>{navigate(p);setOpen(false)}}><span>{i}</span>{n}</button>)}</nav><div className="side-bottom"><div className="plan-mini"><small>PLANO PROFISSIONAL</small><div><span><i style={{width:"72%"}} /></span><b>18/30</b></div><em>produtos cadastrados</em><button onClick={()=>navigate("/precos")}>Ver planos →</button></div><button className="account" onClick={()=>notify("Perfil de demonstração: Mariana Costa.")}><span>MC</span><div><b>Mariana Costa</b><small>demo@caixly.com.br</small></div><i>⋮</i></button></div></aside>{open&&<div className="aside-backdrop" onClick={()=>setOpen(false)} />}<div className="app-content"><header className="app-top"><button className="menu" onClick={()=>setOpen(true)}>☰</button><button className="store-select" onClick={()=>navigate("/ConfiguracoesLoja")}><span>🥣</span><div><small>ESTABELECIMENTO</small><b>Bosque Açaí <i>⌄</i></b></div></button><div className="top-actions"><button aria-label="Ajuda" onClick={()=>notify("Central de ajuda aberta. Fale conosco em suporte@caixly.com.br")}>?</button><button aria-label="Notificações" onClick={()=>notify("Você não tem novas notificações.")}>♧<i /></button><span className="online"><i /> Caixa online</span></div></header>{children}</div></div>;
}

function HomeDashboard() {
  return <AppShell active="Início"><main className="dashboard-page"><div className="dash-head"><div><small>QUARTA-FEIRA, 29 DE JULHO</small><h1>Boa tarde, Mariana 👋</h1><p>Aqui está o resumo do seu negócio hoje.</p></div><button className="button primary" onClick={()=>navigate("/PDV")}>＋ Novo pedido</button></div><div className="summary-grid"><Summary icon="↗" title="Vendas hoje" value="R$ 1.284,50" change="+18,2%" foot="vs. quarta passada" accent /><Summary icon="▤" title="Pedidos hoje" value="42" change="+7" foot="vs. quarta passada" /><Summary icon="◷" title="Ticket médio" value="R$ 30,58" change="+9,4%" foot="vs. média do mês" /><Summary icon="★" title="Produto destaque" value="Açaí Energia" change="14 vendidos" foot="R$ 334,60 em vendas" /></div><div className="dash-grid"><section className="dash-card sales-card"><div className="card-title"><div><small>DESEMPENHO</small><h3>Vendas nos últimos 7 dias</h3></div><button onClick={()=>navigate("/Dashboard")}>Últimos 7 dias⌄</button></div><div className="sales-total"><b>R$ 7.842,30</b><span>↗ 12,4% no período</span></div><div className="line-chart"><svg viewBox="0 0 700 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#39d98a" stopOpacity=".35"/><stop offset="1" stopColor="#39d98a" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 150 C70 132 90 142 140 112 S230 125 280 90 S370 115 420 66 S510 88 560 40 S650 70 700 28 L700 190 L0 190 Z"/><path className="line" d="M0 150 C70 132 90 142 140 112 S230 125 280 90 S370 115 420 66 S510 88 560 40 S650 70 700 28"/></svg><div>{["QUI","SEX","SÁB","DOM","SEG","TER","HOJE"].map(x=><span key={x}>{x}</span>)}</div></div></section><section className="dash-card orders-card"><div className="card-title"><div><small>EM TEMPO REAL</small><h3>Últimos pedidos</h3></div><button onClick={()=>navigate("/Dashboard")}>Ver todos →</button></div>{ORDERS.map(o=><button className="order-row order-button" key={o.no} onClick={()=>notify(`Pedido ${o.no}: ${o.items}, total ${money(o.total)}.`)}><span className="order-icon">▤</span><div><b>{o.no}</b><small>{o.time} • {o.items}</small></div><strong>{money(o.total)}</strong><em>Finalizado</em></button>)}</section></div><div className="bottom-grid"><section className="dash-card"><div className="card-title"><div><small>MAIS PEDIDOS</small><h3>Produtos em destaque</h3></div><button onClick={()=>navigate("/Dashboard")}>Este mês⌄</button></div>{PRODUCTS.slice(0,4).map((p,i)=><div className="rank" key={p.id}><b>0{i+1}</b><span>{p.emoji}</span><div><strong>{p.name}</strong><small>{14-i*2} unidades</small></div><em>{money((14-i*2)*p.price)}</em></div>)}</section><section className="insight-card"><span>✦ INSIGHT CAIXLY</span><h3>Seu melhor horário está chegando.</h3><p>Entre 18h e 20h, suas vendas costumam crescer <b>32%</b>. Prepare a equipe e o estoque.</p><button onClick={()=>navigate("/Dashboard")}>Ver análise completa →</button></section></div></main></AppShell>;
}

function Summary({icon,title,value,change,foot,accent}:{icon:string,title:string,value:string,change:string,foot:string,accent?:boolean}) {
  return <div className={`summary ${accent?"accent":""}`}><div className="summary-top"><Icon>{icon}</Icon><span>•••</span></div><small>{title}</small><strong>{value}</strong><div><b>{change}</b><span>{foot}</span></div></div>;
}

function PointOfSale() {
  const [category,setCategory]=useState("Todos");
  const [cart,setCart]=useState<CartItem[]>([]);
  const [query,setQuery]=useState("");
  const [customer,setCustomer]=useState("");
  const [discount,setDiscount]=useState(0);
  const [mobileCart,setMobileCart]=useState(false);
  const [success,setSuccess]=useState(false);
  const categories=["Todos","Açaí","Lanches","Acompanhamentos","Bebidas","Doces"];
  const shown=(category==="Todos"?PRODUCTS:PRODUCTS.filter(p=>p.category===category)).filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const total=Math.max(0,subtotal-discount);
  const add=(p:Product)=>setCart(prev=>prev.some(x=>x.id===p.id)?prev.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x):[...prev,{...p,qty:1}]);
  const qty=(id:number,d:number)=>setCart(prev=>prev.map(x=>x.id===id?{...x,qty:x.qty+d}:x).filter(x=>x.qty>0));
  const finish=()=>{if(!cart.length)return;setSuccess(true);setCart([]);setCustomer("");setDiscount(0)};
  const askCustomer=()=>{const value=window.prompt("Nome ou telefone do cliente:",customer);if(value!==null){setCustomer(value.trim());notify(value.trim()?"Cliente adicionado ao pedido.":"Cliente removido do pedido.")}};
  const askDiscount=()=>{const value=window.prompt("Valor do desconto em reais:","0");if(value===null)return;const amount=Math.max(0,Math.min(subtotal,Number(value.replace(",","."))||0));setDiscount(amount);notify(amount?`Desconto de ${money(amount)} aplicado.`:"Desconto removido.")};
  return <AppShell active="Novo pedido"><main className="pos-page"><section className={`catalog ${mobileCart?"mobile-hidden":""}`}><div className="pos-head"><div><small>NOVO PEDIDO</small><h1>O que vamos vender hoje?</h1></div><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto..." /></label></div><div className="category-row">{categories.map(c=><button className={c===category?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div><div className="product-grid">{shown.map(p=><button className="product-card" key={p.id} onClick={()=>add(p)}><span>{p.emoji}</span><div><small>{p.category.toUpperCase()}</small><h3>{p.name}</h3><p>{p.description}</p><footer><b>{money(p.price)}</b><i>＋</i></footer></div></button>)}</div>{!shown.length&&<div className="no-results">Nenhum produto encontrado.</div>}</section><aside className={`cart-panel ${mobileCart?"mobile-open":""}`}><div className="cart-title"><div><small>PEDIDO ATUAL</small><h2>Carrinho <span>{cart.reduce((s,i)=>s+i.qty,0)}</span></h2></div><button onClick={()=>{setCart([]);setDiscount(0)}}>Limpar</button></div><button className="cart-customer" onClick={askCustomer}><span>{customer?"✓":"＋"}</span><div><b>{customer||"Adicionar cliente"}</b><small>{customer?"Cliente identificado":"Nome ou telefone (opcional)"}</small></div><i>›</i></button><div className="cart-items">{!cart.length?<div className="empty-cart"><span>🛒</span><b>Seu carrinho está vazio</b><p>Escolha um produto para começar o pedido.</p></div>:cart.map(i=><div className="cart-item" key={i.id}><span>{i.emoji}</span><div><b>{i.name}</b><small>{money(i.price)}</small><div className="qty"><button onClick={()=>qty(i.id,-1)}>−</button><b>{i.qty}</b><button onClick={()=>qty(i.id,1)}>＋</button></div></div><strong>{money(i.price*i.qty)}</strong></div>)}</div><div className="cart-total"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Desconto</span><button onClick={askDiscount}>{discount?`− ${money(discount)}`:"Adicionar"}</button></div><div className="grand"><span>Total</span><b>{money(total)}</b></div><button className="button primary full" disabled={!cart.length} onClick={finish}>Finalizar pedido <span>→</span></button><small>O pedido será registrado como finalizado</small></div></aside><button className="mobile-cart-button" onClick={()=>setMobileCart(!mobileCart)}>{mobileCart?"← Voltar ao cardápio":`Ver carrinho • ${money(total)}`}</button>{success&&<div className="modal-backdrop"><div className="success-modal"><span>✓</span><small>PEDIDO FINALIZADO</small><h2>Venda registrada!</h2><p>Pedido <b>#1049</b> concluído com sucesso.</p><div><button className="button outline" onClick={()=>window.print()}>⌑ Imprimir</button><button className="button primary" onClick={()=>setSuccess(false)}>Novo pedido</button></div></div></div>}</main></AppShell>;
}

function Analytics() {
  const [period,setPeriod]=useState("7 dias");
  const metrics:Record<string,[string,string,string]>={"Hoje":["R$ 1.284,50","42","R$ 30,58"],"7 dias":["R$ 7.842,30","264","R$ 29,71"],"30 dias":["R$ 31.460,80","1.018","R$ 30,90"],"Personalizado":["R$ 7.842,30","264","R$ 29,71"]};
  const exportCsv=()=>{const rows=["pedido,horario,itens,status,total",...ORDERS.map(o=>`${o.no},${o.time},${o.items},${o.status},${o.total.toFixed(2)}`)];const url=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="relatorio-caixly.csv";link.click();URL.revokeObjectURL(url);notify("Relatório exportado com sucesso.")};
  return <AppShell active="Dashboard"><main className="dashboard-page"><div className="dash-head"><div><small>RELATÓRIOS</small><h1>Dashboard</h1><p>Entenda seu negócio e tome decisões melhores.</p></div><div className="period">{["Hoje","7 dias","30 dias","Personalizado"].map(p=><button key={p} className={period===p?"active":""} onClick={()=>{setPeriod(p);if(p==="Personalizado")notify("Período personalizado: demonstração dos últimos 7 dias.")}}>{p}</button>)}</div></div><div className="summary-grid three"><Summary icon="↗" title="Vendas no período" value={metrics[period][0]} change="+12,4%" foot="vs. período anterior" accent /><Summary icon="▤" title="Pedidos" value={metrics[period][1]} change="+22" foot="vs. período anterior" /><Summary icon="◷" title="Ticket médio" value={metrics[period][2]} change="+3,2%" foot="vs. período anterior" /></div><div className="dash-grid"><section className="dash-card sales-card"><div className="card-title"><div><small>RECEITA</small><h3>Vendas por dia</h3></div><span className="legend"><i/> Vendas</span></div><div className="line-chart tall"><svg viewBox="0 0 700 230" preserveAspectRatio="none"><path className="area" d="M0 180 C80 150 120 180 175 120 S270 155 350 95 S440 130 525 60 S620 85 700 25 L700 230 L0 230 Z"/><path className="line" d="M0 180 C80 150 120 180 175 120 S270 155 350 95 S440 130 525 60 S620 85 700 25"/></svg><div>{["23 JUL","24 JUL","25 JUL","26 JUL","27 JUL","28 JUL","29 JUL"].map(x=><span key={x}>{x}</span>)}</div></div></section><section className="dash-card"><div className="card-title"><div><small>PARTICIPAÇÃO</small><h3>Vendas por categoria</h3></div></div><div className="donut"><div><b>R$ 7,8k</b><small>TOTAL</small></div></div><ul className="donut-list">{[["Açaí","44%"],["Lanches","31%"],["Bebidas","17%"],["Outros","8%"]].map((x,i)=><li key={x[0]}><i className={`c${i}`}/><span>{x[0]}</span><b>{x[1]}</b></li>)}</ul></section></div><section className="dash-card order-table"><div className="card-title"><div><small>HISTÓRICO</small><h3>Pedidos recentes</h3></div><button onClick={exportCsv}>Exportar relatório ↓</button></div><table><thead><tr><th>Pedido</th><th>Horário</th><th>Itens</th><th>Status</th><th>Total</th></tr></thead><tbody>{ORDERS.concat([{no:"#1044",time:"13:22",items:"2 itens",total:36.8,status:"Finalizado"}]).map(o=><tr key={o.no}><td><b>{o.no}</b></td><td>{o.time}</td><td>{o.items}</td><td><span className="status">● {o.status}</span></td><td><b>{money(o.total)}</b></td></tr>)}</tbody></table></section></main></AppShell>;
}

function Products() {
  const [products,setProducts]=useState(PRODUCTS);
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("Todos");
  const filtered=products.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())&&(filter==="Todos"||(filter==="Ativos"?(p.active!==false):(p.active===false))));
  const addProduct=()=>{const name=window.prompt("Nome do novo produto:");if(!name?.trim())return;setProducts([...products,{id:Date.now(),name:name.trim(),category:"Açaí",price:12.9,emoji:"✨",description:"Novo produto",active:true}]);notify("Produto adicionado ao catálogo.")};
  const toggleProduct=(id:number)=>{setProducts(products.map(p=>p.id===id?{...p,active:p.active===false}:p));notify("Disponibilidade do produto atualizada.")};
  return <AppShell active="Produtos"><main className="dashboard-page"><div className="dash-head"><div><small>CATÁLOGO</small><h1>Produtos</h1><p>Gerencie seu cardápio, preços e disponibilidade.</p></div><button className="button primary" onClick={addProduct}>＋ Adicionar produto</button></div><div className="product-tools"><label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome..." /></label><div>{["Todos","Ativos","Inativos"].map(f=><button key={f} className={filter===f?"active":""} onClick={()=>setFilter(f)}>{f}{f==="Todos"&&<span>{products.length}</span>}</button>)}</div></div><section className="dash-card product-table"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div className="table-product"><span>{p.emoji}</span><div><b>{p.name}</b><small>{p.description}</small></div></div></td><td><span className="category-badge">{p.category}</span></td><td><b>{money(p.price)}</b></td><td><span className={`status ${p.active===false?"inactive":""}`}>● {p.active===false?"Inativo":"Ativo"}</span></td><td><button className="row-action" onClick={()=>toggleProduct(p.id)}>{p.active===false?"Ativar":"Desativar"}</button></td></tr>)}</tbody></table>{!filtered.length&&<div className="no-results">Nenhum produto neste filtro.</div>}</section><div className="limit-bar"><span><b>{products.length} de 30</b> produtos cadastrados</span><i><b style={{width:`${products.length/30*100}%`}} /></i><small>Plano Profissional</small></div></main></AppShell>;
}

function Settings() {
  const [saved,setSaved]=useState(false);
  const [tab,setTab]=useState("Informações gerais");
  const save=()=>{setSaved(true);setTimeout(()=>setSaved(false),1800)};
  const general=<><div className="card-title"><div><small>INFORMAÇÕES GERAIS</small><h3>Sobre o estabelecimento</h3><p>Essas informações aparecem no seu caixa e comprovantes.</p></div></div><div className="logo-upload"><span>🥣</span><div><b>Logo do estabelecimento</b><small>PNG ou JPG, até 2 MB</small><button onClick={()=>notify("Envio de logo disponível na versão conectada ao backend.")}>Alterar logo</button></div></div><div className="form-grid"><label>Nome do estabelecimento<input defaultValue="Bosque Açaí" onBlur={save} maxLength={60}/></label><label>Tipo de negócio<select defaultValue="acai" onChange={save}><option value="acai">Açaíteria</option><option>Lanchonete</option><option>Padaria</option></select></label><label className="wide">Endereço<input defaultValue="Av. Paulo Faccini, 1840 — Guarulhos, SP" onBlur={save} maxLength={120}/></label><label>Telefone / WhatsApp<input defaultValue="(11) 99942-8841" onBlur={save}/></label><label>Nome do ponto de atendimento<input defaultValue="Balcão principal" onBlur={save}/></label><label className="wide">Descrição<textarea defaultValue="Açaí de verdade, feito com carinho todos os dias." onBlur={save} maxLength={120}/></label></div></>;
  const hours=<><div className="card-title"><div><small>FUNCIONAMENTO</small><h3>Horários e dias de atendimento</h3><p>Defina quando sua loja aparece como aberta.</p></div></div><div className="form-grid"><label>Abre às<input type="time" defaultValue="09:00" onChange={save}/></label><label>Fecha às<input type="time" defaultValue="22:00" onChange={save}/></label></div><div className="week-days">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((day,i)=><label key={day}><input type="checkbox" defaultChecked={i>0&&i<6} onChange={save}/><span>{day}</span></label>)}</div></>;
  const appearance=<><div className="card-title"><div><small>APARÊNCIA</small><h3>Cores e tema</h3><p>Personalize o caixa com a identidade da sua marca.</p></div></div><div className="appearance-grid"><label>Cor principal<input type="color" defaultValue="#39d98a" onChange={save}/></label><label>Cor dos botões<input type="color" defaultValue="#1fbd72" onChange={save}/></label><label className="switch-row"><span><b>Tema escuro</b><small>Recomendado para o caixa</small></span><input type="checkbox" defaultChecked onChange={save}/></label></div></>;
  const security=<><div className="card-title"><div><small>SEGURANÇA</small><h3>Proteção da operação</h3><p>Controle sessões e ações sensíveis da equipe.</p></div></div><div className="security-list"><label><span><b>Exigir PIN para cancelamentos</b><small>Gerente aprova operações críticas.</small></span><input type="checkbox" defaultChecked onChange={save}/></label><label><span><b>Bloquear caixa após inatividade</b><small>Solicita login novamente após 15 minutos.</small></span><input type="checkbox" defaultChecked onChange={save}/></label><button className="button outline" onClick={()=>navigate("/Equipe")}>Gerenciar equipe e permissões →</button></div></>;
  const subscription=<><div className="card-title"><div><small>ASSINATURA</small><h3>Plano Profissional</h3><p>Seu plano atual permite até 30 produtos e relatórios avançados.</p></div></div><div className="subscription-box"><span>PROFISSIONAL</span><b>R$ 79,90 <small>/ mês</small></b><p>Próxima cobrança: configuração do Stripe pendente.</p><button className="button primary" onClick={()=>navigate("/precos")}>Ver todos os planos</button></div></>;
  const panels:Record<string,React.ReactNode>={"Informações gerais":general,"Horários":hours,"Aparência":appearance,"Segurança":security,"Assinatura":subscription};
  return <AppShell active="Configurações"><main className="dashboard-page settings"><div className="dash-head"><div><small>PERSONALIZAÇÃO</small><h1>Configurações da loja</h1><p>Deixe o Caixly com a cara do seu negócio.</p></div>{saved&&<span className="saved">✓ Alterações salvas</span>}</div><div className="settings-grid"><section className="dash-card settings-nav">{[["▣","Informações gerais"],["◷","Horários"],["◉","Aparência"],["♢","Segurança"],["▤","Assinatura"]].map(([icon,name])=><button key={name} className={tab===name?"active":""} onClick={()=>setTab(name)}>{icon} {name}</button>)}</section><section className="dash-card settings-form">{panels[tab]}<div className="form-actions"><span>As alterações são salvas automaticamente.</span><button className="button primary" onClick={save}>Salvar alterações</button></div></section></div></main></AppShell>;
}

function AccessManagement() {
  const [selected,setSelected]=useState("owner");
  const tenantRoles=ROLES.filter(role=>role.id!=="super_admin");
  const current=tenantRoles.find(r=>r.id===selected)??tenantRoles[0];
  return <AppShell active="Equipe e acessos"><main className="dashboard-page access-page"><div className="dash-head"><div><small>SEGURANÇA DA SUA EMPRESA</small><h1>Equipe e acessos</h1><p>Gerencie somente os usuários, lojas e filiais da sua própria empresa.</p></div><button className="button primary" onClick={()=>notify("Convite preparado. Conecte o backend para enviar por e-mail.")}>＋ Convidar funcionário</button></div><div className="security-banner"><span>◈</span><div><b>O painel do dono do Caixly não faz parte desta área</b><p>Clientes nunca visualizam, criam ou atribuem o papel Super Admin. Aqui existem somente Administrador, Gerente e Operador.</p></div></div><div className="role-cards tenant-role-cards">{tenantRoles.map(role=><button key={role.id} className={`${role.color} ${selected===role.id?"active":""}`} onClick={()=>setSelected(role.id)}><span>{role.icon}</span><div><b>{role.name}</b><small>{role.subtitle}</small></div><i>{selected===role.id?"✓":"›"}</i></button>)}</div><section className="dash-card role-detail"><div className="role-detail-head"><span className={current.color}>{current.icon}</span><div><small>NÍVEL DE ACESSO DO CLIENTE</small><h2>{current.name}</h2><p>{current.subtitle}</p></div></div><div className="scope-box"><b>Escopo de acesso</b><p>{current.scope}</p></div><div className="crud-grid"><div><span>C</span><b>Criar</b><p>{current.create}</p></div><div><span>R</span><b>Ler</b><p>{current.read}</p></div><div><span>U</span><b>Atualizar</b><p>{current.update}</p></div><div><span>D</span><b>Excluir / cancelar</b><p>{current.remove}</p></div></div><div className="restriction-box"><span>!</span><div><b>Restrições cruciais</b><p>{current.restrictions}</p></div></div></section><section className="dash-card matrix-card"><div className="card-title"><div><small>MATRIZ DA EMPRESA CLIENTE</small><h3>Permissões críticas por papel</h3></div></div><div className="matrix-scroll"><table><thead><tr><th>Ação</th><th>Administrador</th><th>Gerente</th><th>Operador</th></tr></thead><tbody>{[["Ver lucro e custos","Todas as lojas","Não","Não"],["Alterar preços","Sim","Sob delegação","Não"],["Ajustar estoque","Todas as lojas","Filial atribuída","Não"],["Aplicar desconto","Define política","Aprova limite","Dentro do limite"],["Sangria / suprimento","Sim","Sim","Solicita"],["Cancelar venda fiscal","Sim, auditado","Com motivo e PIN","Não"],["Fechar caixa","Qualquer filial","Filial atribuída","Somente pré-fechamento"],["Gerenciar usuários","Equipe da empresa","Operadores da filial","Não"]].map(row=><tr key={row[0]}>{row.map((cell,i)=><td key={i}>{i===0?<b>{cell}</b>:cell}</td>)}</tr>)}</tbody></table></div></section><section className="audit-note"><b>Separação obrigatória</b><p>O tenant e a filial vêm da sessão autenticada. Nenhuma conta de cliente pode consultar ou alterar registros do painel interno do Caixly. O papel Super Admin não aparece em formulários, APIs públicas ou listas de permissões dos clientes.</p></section></main></AppShell>;
}

function SaaSOwnerPanel() {
  return <div className="saas-owner"><aside><Logo/><span>PAINEL INTERNO</span><nav><button className="active">◆ Visão global</button><button onClick={()=>notify("Lista de clientes carregada em modo demonstrativo.")}>▦ Empresas clientes</button><button onClick={()=>notify("Assinaturas serão conectadas ao Stripe posteriormente.")}>◫ Assinaturas</button><button onClick={()=>notify("Auditoria interna sem eventos críticos.")}>◎ Auditoria</button></nav><div><small>ACESSO EXCLUSIVO</small><b>Dono do Caixly</b><p>Este papel não pode ser delegado.</p></div></aside><main><header><div><small>PAINEL DO FUNDADOR</small><h1>Visão global do Caixly</h1><p>Área interna, isolada de todas as contas de clientes.</p></div><span className="owner-lock">🔒 Super Admin exclusivo</span></header><div className="owner-warning"><b>Conta de plataforma</b><p>Somente sua identidade pode receber esta função. Donos de lojas são Administradores de seus próprios tenants, nunca Super Admins.</p></div><div className="owner-metrics"><Summary icon="▦" title="Empresas ativas" value="12" change="+3" foot="este mês" accent/><Summary icon="↗" title="Receita recorrente" value="R$ 1.078,80" change="+18%" foot="MRR"/><Summary icon="◷" title="Assinaturas em dia" value="11" change="91,7%" foot="da base"/><Summary icon="!" title="Atenção necessária" value="1" change="Inadimplente" foot="aguardando ação"/></div><section className="dash-card owner-tenants"><div className="card-title"><div><small>CLIENTES DO SAAS</small><h3>Empresas recentes</h3></div><button onClick={()=>notify("Filtros globais disponíveis após conexão do backend.")}>Filtrar empresas</button></div><table><thead><tr><th>Empresa</th><th>Plano</th><th>Lojas</th><th>Status</th><th>Ação</th></tr></thead><tbody>{[["Bosque Açaí","Profissional","2","Ativa"],["Santo Smash","Essencial","1","Ativa"],["Pão & Prosa","Premium","4","Ativa"],["Doce Frio","Essencial","1","Pagamento pendente"]].map(row=><tr key={row[0]}><td><b>{row[0]}</b></td><td>{row[1]}</td><td>{row[2]}</td><td><span className={row[3]==="Ativa"?"status":"status inactive"}>● {row[3]}</span></td><td><button onClick={()=>notify(`${row[0]} selecionada. Ações administrativas exigem confirmação e auditoria.`)}>Gerenciar</button></td></tr>)}</tbody></table></section><div className="owner-policies"><div><span>01</span><b>Sem acesso cruzado</b><p>Clientes nunca enxergam outros tenants nem este painel.</p></div><div><span>02</span><b>Sem delegação</b><p>Nenhum cliente ou funcionário cria outro Super Admin.</p></div><div><span>03</span><b>Auditoria total</b><p>Bloqueios, suporte e alterações globais ficam registrados.</p></div></div></main></div>;
}

function Onboarding() {
  const [step,setStep]=useState(1);
  return <main className="onboarding"><header><Logo /><span>Precisa de ajuda? <b>Fale com a gente</b></span></header><div className="onboard-wrap"><div className="steps"><i className="active">1</i><span className={step>1?"done":""}/><i className={step>1?"active":""}>2</i><span/><i>3</i></div>{step===1?<section><small>VAMOS COMEÇAR</small><h1>Conte um pouco sobre<br />o seu negócio.</h1><p>Isso ajuda a deixar o Caixly pronto para você.</p><div className="business-grid">{SEGMENTS.map(([e,n])=><button key={n} onClick={()=>setStep(2)}><span>{e}</span><b>{n}</b></button>)}</div></section>:<section><small>QUASE LÁ</small><h1>Como podemos chamar<br />o seu negócio?</h1><p>Você poderá alterar essas informações depois.</p><div className="onboard-form"><label>Nome do estabelecimento<input autoFocus placeholder="Ex.: Bosque Açaí" /></label><label>Endereço<input placeholder="Rua, número e cidade" /></label><label>Ponto de atendimento<input placeholder="Ex.: Balcão principal" /></label><button className="button primary full" onClick={()=>navigate("/Home")}>Criar meu espaço →</button></div></section>}</div></main>;
}

function SegmentPage({name,emoji}:{name:string,emoji:string}) {
  return <main className="landing segment-page"><PublicHeader/><section className="segment-hero"><div><div className="eyebrow">{emoji} FEITO PARA {name.toUpperCase()}</div><h1>O sistema de PDV que<br /><span>entende seu balcão.</span></h1><p>Pedidos mais rápidos, cardápio organizado e números claros para você cuidar do seu {name.toLowerCase()} com tranquilidade.</p><button className="button primary large" onClick={()=>navigate("/CheckIn")}>Testar grátis por 14 dias →</button><div className="trust-row"><span>✓ Sem instalação</span><span>✓ Funciona no celular</span><span>✓ Suporte brasileiro</span></div></div><div className="segment-art"><span>{emoji}</span><div><small>VENDAS DE HOJE</small><b>R$ 1.284,50</b><em>↗ 18,2% esta semana</em></div></div></section><section className="section center-heading"><small>UMA ROTINA MAIS LEVE</small><h2>Do pedido ao fechamento,<br /><span>tudo no lugar.</span></h2><div className="benefit-grid">{[["⚡","Atenda em segundos","Cardápio visual e carrinho simples para reduzir filas."],["📦","Organize seus produtos","Preços, adicionais e disponibilidade sempre atualizados."],["📊","Entenda suas vendas","Veja os campeões de venda e horários mais fortes."]].map(([e,t,d])=><div key={t}><span>{e}</span><h3>{t}</h3><p>{d}</p></div>)}</div></section><section className="final-cta compact-cta"><div><small>PRONTO PARA COMEÇAR?</small><h2>Seu {name.toLowerCase()},<br /><span>mais simples.</span></h2><button className="button light large" onClick={()=>navigate("/CheckIn")}>Começar gratuitamente →</button></div></section><Footer/></main>;
}

function InfoPage({kind}:{kind:string}) {
  const pages:Record<string,{eyebrow:string,title:string,description:string,items:string[]}>={
    funcionalidades:{eyebrow:"RECURSOS",title:"Tudo para operar com segurança.",description:"PDV, produtos, relatórios, configurações e controle de acesso em uma experiência simples.",items:["Frente de caixa rápida e responsiva","Produtos, adicionais e disponibilidade","Relatórios e exportação de vendas","Controle de equipe com RBAC","Configurações por loja e filial","Auditoria de operações críticas"]},
    precos:{eyebrow:"PLANOS",title:"Um plano para cada fase.",description:"Comece gratuitamente e evolua quando sua operação precisar.",items:["Gratuito — até 5 produtos","Essencial — R$ 49,90/mês","Profissional — R$ 79,90/mês","Premium — R$ 119,90/mês"]},
    sobre:{eyebrow:"SOBRE O CAIXLY",title:"Tecnologia que respeita a rotina do balcão.",description:"O Caixly nasceu para tornar a gestão de pequenos negócios mais simples, clara e segura.",items:["Construído para o varejo brasileiro","Experiência simples no celular e computador","Decisões guiadas por dados úteis","Segurança desde a arquitetura"]},
    privacidade:{eyebrow:"PRIVACIDADE",title:"Seus dados, sob controle.",description:"Aplicamos isolamento entre empresas, acesso por função, minimização de dados e rastreabilidade.",items:["Isolamento lógico por tenant","Privilégio mínimo por usuário","Auditoria de ações sensíveis","Retenção e exclusão conforme LGPD"]},
    termos:{eyebrow:"TERMOS DE USO",title:"Regras claras para uma relação simples.",description:"Esta versão apresenta um resumo demonstrativo. Os termos jurídicos finais serão revisados antes da operação comercial.",items:["Uso responsável da plataforma","Responsabilidade sobre cadastros e usuários","Disponibilidade e suporte","Cobrança e cancelamento transparentes"]},
  };
  const page=pages[kind]??pages.funcionalidades;
  return <main className="landing info-page"><PublicHeader/><section className="info-hero"><small>{page.eyebrow}</small><h1>{page.title}</h1><p>{page.description}</p><div className="info-list">{page.items.map((item,i)=><div key={item}><span>{String(i+1).padStart(2,"0")}</span><b>{item}</b><i>✓</i></div>)}</div><button className="button primary large" onClick={()=>navigate("/CheckIn")}>Começar gratuitamente →</button></section><Footer/></main>;
}

function CaixlyRoute() {
  const [path,setPath]=useState("/");
  useEffect(()=>{const sync=()=>setPath(window.location.pathname);sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync)},[]);
  if(path==="/"||path==="/Index"||path==="/LandingPage") return <Landing/>;
  if(path==="/CheckIn"||path==="/acesso"||path==="/Login"||path==="/Register") return <CheckIn/>;
  if(path==="/Home") return <HomeDashboard/>;
  if(path==="/PDV") return <PointOfSale/>;
  if(path==="/Dashboard"||path==="/DashboardPremium") return <Analytics/>;
  if(path==="/Produtos"||path==="/ProductsManagement"||path==="/ProdutosNovo") return <Products/>;
  if(path==="/ConfiguracoesLoja"||path==="/Admin") return <Settings/>;
  if(path==="/Equipe") return <AccessManagement/>;
  if(path==="/SaaSAdmin") return <SaaSOwnerPanel/>;
  if(path==="/Onboarding") return <Onboarding/>;
  const segment=SEGMENTS.find(s=>s[2]===path);
  if(segment) return <SegmentPage emoji={segment[0]} name={segment[1]}/>;
  const infoKind=path.replace("/","");
  if(["funcionalidades","precos","sobre","privacidade","termos"].includes(infoKind)) return <InfoPage kind={infoKind}/>;
  return <Landing/>;
}

export function CaixlyApp() {
  return <><CaixlyRoute/><ToastLayer/></>;
}
