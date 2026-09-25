// Whether the screen a live read belongs to is in front (DESIGN §2.4, §4.7). Tabs stay mounted
// and a stack keeps the screens behind the top one, so without this every live read on every
// mounted screen would re-run after each set is logged. The navigators wrap each screen in
// `ActiveWhileFocused`; outside a navigator (tests, the launch gate) a screen counts as active.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const ScreenActiveContext = createContext(true);

export function useScreenActive(): boolean {
  return useContext(ScreenActiveContext);
}

/** The part of a navigation object this needs; a React Navigation screen's `navigation` fits. */
export interface FocusSource {
  isFocused(): boolean;
  addListener(event: 'focus' | 'blur', callback: () => void): () => void;
}

/**
 * Marks the screen active while it is focused and its parent screen is too, so a tab under a
 * full-screen modal counts as hidden. Use it as a navigator's `screenLayout`.
 */
export function ActiveWhileFocused({
  navigation,
  children,
}: {
  navigation: FocusSource;
  children: ReactNode;
}) {
  const parent = useContext(ScreenActiveContext);
  const [focused, setFocused] = useState(() => navigation.isFocused());
  useEffect(() => {
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return (
    <ScreenActiveContext.Provider value={parent && focused}>
      {children}
    </ScreenActiveContext.Provider>
  );
}
