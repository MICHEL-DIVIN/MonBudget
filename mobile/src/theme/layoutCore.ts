/**
 * Mise en page adaptative. Repères :
 *  - compact : petits téléphones (largeur < 360, ex. iPhone SE 1re gén., Android d'entrée de gamme) ;
 *  - short   : écrans bas (hauteur < 700, ex. iPhone SE 2/3, ou paysage) ;
 *  - tablet  : plus petit côté ≥ 600 (iPad, tablettes Android).
 * Sur tablette, le contenu est centré dans une colonne lisible au lieu de s'étirer.
 */

export const CONTENT_MAX_WIDTH = 640;
const BASE_WIDTH = 390; // iPhone 14/15 : référence des maquettes

export interface Layout {
  width: number;
  height: number;
  compact: boolean;
  short: boolean;
  tablet: boolean;
  /** Largeur utile de la colonne de contenu (bornée sur tablette). */
  contentWidth: number;
  /** Marge latérale. */
  gutter: number;
  /** Facteur pour les grands titres et montants (les petits textes ne bougent pas). */
  typeScale: number;
  /** Mise à l'échelle modérée d'une dimension (icônes, illustrations…). */
  scale: (n: number) => number;
}

export function computeLayout(width: number, height: number): Layout {
  const compact = width < 360;
  const short = height < 700;
  const tablet = Math.min(width, height) >= 600;
  const gutter = tablet ? 24 : compact ? 12 : 16;
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const ratio = Math.max(0.85, Math.min(1.2, width / BASE_WIDTH));
  const typeScale = tablet ? 1.12 : compact ? 0.86 : short ? 0.94 : 1;
  return {
    width,
    height,
    compact,
    short,
    tablet,
    contentWidth,
    gutter,
    typeScale,
    // Échelle « modérée » : on ne suit qu'à moitié la largeur pour ne pas tout grossir sur tablette.
    scale: (n: number) => Math.round(n * (1 + (ratio - 1) * 0.5)),
  };
}

/** Nombre de colonnes d'une grille de tuiles selon la largeur disponible. */
export function gridColumns(available: number, minTile = 80, min = 4, max = 6): number {
  return Math.max(min, Math.min(max, Math.floor(available / minTile)));
}
