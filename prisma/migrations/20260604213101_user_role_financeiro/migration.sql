-- Call 18/05: hierarquia ADMIN / GESTOR / FINANCEIRO / OPERADOR.
-- Adiciona o valor FINANCEIRO ao enum UserRole.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCEIRO';
