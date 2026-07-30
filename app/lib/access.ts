export type TenantRole = "admin" | "manager" | "cashier";
export type PlanCode = "free" | "essential" | "professional" | "unlimited";

export const PLAN_LIMITS: Record<PlanCode, number | null> = {
  free: 5,
  essential: 15,
  professional: 30,
  unlimited: null,
};

export const PLAN_LABELS: Record<PlanCode, string> = {
  free: "Gratuito",
  essential: "Essencial",
  professional: "Profissional",
  unlimited: "Ilimitado",
};

const ROLE_ROUTES: Record<TenantRole, readonly string[]> = {
  admin: ["/Home", "/PDV", "/Dashboard", "/Produtos", "/ConfiguracoesLoja", "/Equipe"],
  manager: ["/Home", "/PDV", "/Dashboard", "/Produtos", "/Equipe"],
  cashier: ["/PDV"],
};

export function canAccessRoute(role: TenantRole, path: string) {
  const normalized =
    path === "/DashboardPremium" ? "/Dashboard" :
    path === "/ProductsManagement" || path === "/ProdutosNovo" ? "/Produtos" :
    path === "/Admin" ? "/ConfiguracoesLoja" :
    path;
  return ROLE_ROUTES[role].includes(normalized);
}

export function defaultRoute(role: TenantRole) {
  return role === "cashier" ? "/PDV" : "/Home";
}

export function canManageProducts(role: TenantRole) {
  return role === "admin" || role === "manager";
}

export function canManageTeam(role: TenantRole) {
  return role === "admin" || role === "manager";
}

export function canViewFinancials(role: TenantRole) {
  return role === "admin";
}

export function hasProductCapacity(plan: PlanCode, currentCount: number) {
  const limit = PLAN_LIMITS[plan];
  return limit === null || currentCount < limit;
}
