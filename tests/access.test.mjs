import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_LIMITS,
  canAccessRoute,
  canManageProducts,
  canViewFinancials,
  defaultRoute,
  hasProductCapacity,
} from "../app/lib/access.ts";

test("limites dos planos são os definidos pelo produto", () => {
  assert.deepEqual(PLAN_LIMITS, {
    free: 5,
    essential: 15,
    professional: 30,
    unlimited: null,
  });
  assert.equal(hasProductCapacity("free", 4), true);
  assert.equal(hasProductCapacity("free", 5), false);
  assert.equal(hasProductCapacity("essential", 15), false);
  assert.equal(hasProductCapacity("professional", 29), true);
  assert.equal(hasProductCapacity("unlimited", 999_999), true);
});

test("operador fica restrito à frente de caixa", () => {
  assert.equal(defaultRoute("cashier"), "/PDV");
  assert.equal(canAccessRoute("cashier", "/PDV"), true);
  assert.equal(canAccessRoute("cashier", "/Dashboard"), false);
  assert.equal(canAccessRoute("cashier", "/Produtos"), false);
  assert.equal(canAccessRoute("cashier", "/Equipe"), false);
  assert.equal(canViewFinancials("cashier"), false);
});

test("gerente opera a filial sem configurações financeiras", () => {
  assert.equal(canAccessRoute("manager", "/Dashboard"), true);
  assert.equal(canManageProducts("manager"), true);
  assert.equal(canAccessRoute("manager", "/ConfiguracoesLoja"), false);
  assert.equal(canViewFinancials("manager"), false);
});

test("administrador da empresa não recebe acesso de plataforma", () => {
  assert.equal(canAccessRoute("admin", "/Equipe"), true);
  assert.equal(canAccessRoute("admin", "/SaaSAdmin"), false);
  assert.equal(canViewFinancials("admin"), true);
});
