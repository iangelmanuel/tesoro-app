"use client"

import {
  type QuickActionsWorkspace,
  useQuickActions
} from "../quick-actions/quick-actions-context"

// En /dashboard/personal/* es Personal y en /dashboard/business/[id]/* esa
// empresa. En otras rutas (cuenta, estado vacío de Empresa) no hay espacio.
// Lo resuelve QuickActionsProvider por la ruta
export function useActiveWorkspace(): QuickActionsWorkspace | undefined {
  return useQuickActions().workspace
}
