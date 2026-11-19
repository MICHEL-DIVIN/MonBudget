import { useWindowDimensions } from 'react-native';
import { computeLayout, type Layout } from './layoutCore';

export { computeLayout, CONTENT_MAX_WIDTH, gridColumns, type Layout } from './layoutCore';

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return computeLayout(width, height);
}
