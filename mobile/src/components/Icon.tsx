import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type Name = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Les enveloppes stockent des noms Material Symbols (« shopping_cart »).
 * MaterialIcons les nomme avec des tirets (« shopping-cart ») : on convertit et on retombe sur « category ».
 */
export function resolveIcon(name: string): Name {
  const dashed = name.replace(/_/g, '-') as Name;
  return dashed in MaterialIcons.glyphMap ? dashed : 'category';
}

export function Icon({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  return <MaterialIcons name={resolveIcon(name)} size={size} color={color} />;
}
