export type AutoRedirectGuardInput = {
  isProfessional: boolean;
  birthModeDisabled: boolean;
  pathname: string | null;
  activePregnancyIds: string[];
};

/** Verdadeiro quando um redirecionamento automático (mount, visibilidade ou inatividade) pode ser considerado. */
export function canConsiderAutoRedirect(input: AutoRedirectGuardInput): boolean {
  return (
    input.isProfessional &&
    !input.birthModeDisabled &&
    input.activePregnancyIds.length > 0 &&
    !input.pathname?.startsWith("/modo-parto")
  );
}

/** Resolve o pregnancyId alvo do redirect — sempre o primeiro parto ativo retornado pelo backend. */
export function resolveAutoRedirectPregnancyId(activePregnancyIds: string[]): string | null {
  return activePregnancyIds[0] ?? null;
}
