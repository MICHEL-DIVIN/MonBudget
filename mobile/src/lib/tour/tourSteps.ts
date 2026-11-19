/**
 * Étapes de la visite guidée. `order` fixe l'ordre d'affichage ; les textes sont dans translations.ts
 * sous `tour.<name>.title` et `tour.<name>.body`.
 *
 * Où est chaque cible (composant <TourTarget step="…">) :
 *  - hero     : carte « Reste à dépenser »            → src/app/(tabs)/index.tsx
 *  - add      : bouton rond « + » de la barre du bas  → src/components/TabBar.tsx
 *  - activity : onglet « Mouvements »                 → src/components/TabBar.tsx
 *  - budget   : onglet « Budget »                     → src/components/TabBar.tsx
 *  - settings : avatar en haut à droite de l'accueil  → src/components/TabHeader.tsx
 */
export const TOUR_STEPS = [
  { name: 'hero', order: 1 },
  { name: 'add', order: 2 },
  { name: 'activity', order: 3 },
  { name: 'budget', order: 4 },
  { name: 'settings', order: 5 },
] as const;

export type TourStepName = (typeof TOUR_STEPS)[number]['name'];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;

export const tourStep = (name: TourStepName) => TOUR_STEPS.find((s) => s.name === name)!;
