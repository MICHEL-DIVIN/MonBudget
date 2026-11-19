type Listener = () => void;

function createEmitter() {
  const listeners = new Set<Listener>();
  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    emit() {
      listeners.forEach((fn) => fn());
    },
  };
}

/** Les données locales ont changé (écriture locale OU application de données serveur) : rafraîchir l'UI. */
export const dataChanged = createEmitter();
/** L'utilisateur a modifié une donnée : planifier une synchronisation. */
export const localMutation = createEmitter();
