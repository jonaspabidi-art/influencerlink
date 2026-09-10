import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getItem, setItem } from '../storage';
import { colors, radius, spacing, type } from '../theme';

/**
 * Rundturen: en mörk hinna med ett hål över det som förklaras, en pil och en
 * textbubbla.
 *
 * Två sorters steg. Ett *måltsteg* pekar på något som finns på skärmen – en
 * flik eller en knapp – och det är där pilen gör nytta. Ett *kortsteg* saknar
 * mål och förklarar ett förlopp i stället, för att peka på en knapp som leder
 * vidare säger ingenting om vad som händer efter trycket.
 *
 * Regeln genom hela filen: rundturen får aldrig kunna låsa appen. Hittar den
 * inte sitt mål hoppar den över steget, och hinnan går alltid att stänga.
 */

/** Flikradens höjd, samma tal som i bådas `_layout.tsx`. */
const TAB_BAR_HEIGHT = 76;

/** Luft mellan hålets kant och det markerade, så inget klipps. */
const HOLE_PADDING = 6;

/** Så många gånger ett mått får försökas innan steget visas utan pil. */
const MEASURE_ATTEMPTS = 8;
const MEASURE_DELAY_MS = 150;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TourTarget =
  /** Flik nummer `index` av `count` i flikraden längst ned. */
  | { kind: 'tab'; index: number; count: number }
  /** Något en skärm registrerat med `useTourAnchor`. */
  | { kind: 'anchor'; id: string };

export interface TourStep {
  title: string;
  body: string;
  /** Utan mål visas steget som ett kort mitt på skärmen. */
  target?: TourTarget;
}

interface TourValue {
  /** Startar turen om den inte redan visats för den här nyckeln. */
  startOnce: (key: string, steps: TourStep[]) => void;
  /** Startar turen igen, oavsett vad som visats förut. */
  restart: (key: string, steps: TourStep[]) => void;
  registerAnchor: (id: string, node: RNView | null) => void;
}

const TourContext = createContext<TourValue | null>(null);

const storageKey = (key: string) => `pacta.tour.${key}`;

export function useTour(): TourValue {
  const value = useContext(TourContext);
  // Utan provider ska turen tiga, inte krascha skärmen som ville starta den.
  return value ?? fallback;
}

const fallback: TourValue = {
  startOnce: () => {},
  restart: () => {},
  registerAnchor: () => {},
};

/**
 * Registrerar en vy som mål för ett `anchor`-steg.
 *
 * Vyn sparas, inte dess mått. Ett mått som tas vid layout blir fel så fort
 * något ovanför ändrar höjd – en lista som fyllts på flyttar allt under sig
 * utan att de vyerna får en ny layout, och då pekar pilen på fel sak. Måttet
 * tas därför om varje gång steget visas.
 */
export function useTourAnchor(id: string): { ref: (node: RNView | null) => void } {
  const { registerAnchor } = useTour();
  const ref = useCallback(
    (node: RNView | null) => registerAnchor(id, node),
    [id, registerAnchor],
  );
  return { ref };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState<{ key: string; steps: TourStep[] } | null>(null);
  const [index, setIndex] = useState(0);
  const anchors = useRef(new Map<string, RNView>());

  const registerAnchor = useCallback((id: string, node: RNView | null) => {
    if (node) anchors.current.set(id, node);
    else anchors.current.delete(id);
  }, []);

  const startOnce = useCallback((key: string, steps: TourStep[]) => {
    void (async () => {
      if (await getItem(storageKey(key))) return;
      setIndex(0);
      setRunning({ key, steps });
    })();
  }, []);

  const restart = useCallback((key: string, steps: TourStep[]) => {
    setIndex(0);
    setRunning({ key, steps });
  }, []);

  /*
   * Att turen visats skrivs ned när den stängs, inte när den startar.
   *
   * Skillnaden märks om appen stängs mitt i: den som aldrig sett klart får se
   * den igen, i stället för att ha förbrukat sin enda visning på ett steg.
   */
  const close = useCallback(() => {
    setRunning((current) => {
      if (current) void setItem(storageKey(current.key), String(Date.now()));
      return null;
    });
  }, []);

  const value = useMemo<TourValue>(
    () => ({ startOnce, restart, registerAnchor }),
    [startOnce, restart, registerAnchor],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {running ? (
        <TourOverlay
          steps={running.steps}
          index={index}
          anchors={anchors.current}
          onIndex={setIndex}
          onClose={close}
        />
      ) : null}
    </TourContext.Provider>
  );
}

function TourOverlay({
  steps,
  index,
  anchors,
  onIndex,
  onClose,
}: {
  steps: TourStep[];
  index: number;
  anchors: Map<string, RNView>;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [hole, setHole] = useState<Rect | null>(null);

  const step = steps[Math.min(index, steps.length - 1)];
  const target = step?.target;

  /*
   * Hålet räknas ut när steget visas, inte i förväg.
   *
   * Flikarna ligger på en känd plats och kan räknas fram direkt. Allt annat
   * måste mätas i fönstret just nu, och hamnar måttet utanför skärmen – vyn
   * är bortrullad eller finns inte längre – blir steget ett kort utan pil i
   * stället. Ett hål över ingenting är sämre än inget hål alls.
   */
  useEffect(() => {
    let live = true;
    setHole(null);
    if (!target) return;

    if (target.kind === 'tab') {
      const barHeight = TAB_BAR_HEIGHT + insets.bottom;
      const cell = width / target.count;
      setHole({ x: cell * target.index, y: height - barHeight, width: cell, height: barHeight });
      return;
    }

    /*
     * Skärmen bakom hinnan kan fortfarande hålla på att laddas, och då finns
     * vyn vi ska peka på ännu inte. Ett par försök till innan vi ger upp, i
     * stället för att steget tappar sin pil för att listan var en bildruta
     * sen. Efter det blir det ett kort utan pil, inte ett hål på fel ställe.
     */
    let attempt = 0;
    const tryMeasure = () => {
      if (!live) return;
      const node = anchors.get(target.id);
      if (node?.measureInWindow) {
        node.measureInWindow((x, y, w, h) => {
          if (!live) return;
          const onScreen = w > 0 && h > 0 && y + h > 0 && y < height;
          if (onScreen) setHole({ x, y, width: w, height: h });
          else if (attempt++ < MEASURE_ATTEMPTS) timer = setTimeout(tryMeasure, MEASURE_DELAY_MS);
        });
        return;
      }
      if (attempt++ < MEASURE_ATTEMPTS) timer = setTimeout(tryMeasure, MEASURE_DELAY_MS);
    };
    let timer = setTimeout(tryMeasure, 0);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [anchors, height, insets.bottom, target, width]);

  if (!step) {
    onClose();
    return null;
  }

  const last = index >= steps.length - 1;
  const next = () => (last ? onClose() : onIndex(index + 1));

  // Bubblan läggs på motsatt sida om hålet, så att den aldrig täcker det.
  const above = hole ? hole.y > height / 2 : false;
  const padded = hole
    ? {
        x: Math.max(0, hole.x - HOLE_PADDING),
        y: Math.max(0, hole.y - HOLE_PADDING),
        width: hole.width + HOLE_PADDING * 2,
        height: hole.height + HOLE_PADDING * 2,
      }
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        accessibilityLabel="Nästa steg i rundturen"
        style={StyleSheet.absoluteFill}
        onPress={next}
      >
        {padded ? (
          <>
            <View style={[styles.dim, { left: 0, right: 0, top: 0, height: padded.y }]} />
            <View
              style={[styles.dim, { left: 0, right: 0, top: padded.y + padded.height, bottom: 0 }]}
            />
            <View
              style={[styles.dim, { left: 0, width: padded.x, top: padded.y, height: padded.height }]}
            />
            <View
              style={[
                styles.dim,
                { left: padded.x + padded.width, right: 0, top: padded.y, height: padded.height },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                { left: padded.x, top: padded.y, width: padded.width, height: padded.height },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        )}
      </Pressable>

      <View
        style={[
          styles.bubbleLayer,
          padded
            ? above
              ? { bottom: height - padded.y + 10 }
              : { top: padded.y + padded.height + 10 }
            : { top: 0, bottom: 0, justifyContent: 'center' },
        ]}
        pointerEvents="box-none"
      >
        {padded && !above ? (
          <Arrow direction="up" x={padded.x + padded.width / 2} layerWidth={width} />
        ) : null}
        <View style={styles.bubble}>
          <Text style={styles.counter}>
            {index + 1} av {steps.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={styles.skip}>{last ? 'Stäng' : 'Hoppa över'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.next} onPress={next}>
              <Text style={styles.nextLabel}>{last ? 'Klart' : 'Nästa'}</Text>
            </Pressable>
          </View>
        </View>
        {padded && above ? (
          <Arrow direction="down" x={padded.x + padded.width / 2} layerWidth={width} />
        ) : null}
      </View>
    </View>
  );
}

/**
 * Triangeln som pekar från bubblan mot hålet.
 *
 * `x` är hålets mitt i skärmens koordinater; bubbellagret har egen inramning,
 * så den räknas om och kläms in så att pilen aldrig hamnar utanför bubblan.
 */
function Arrow({
  direction,
  x,
  layerWidth,
}: {
  direction: 'up' | 'down';
  x: number;
  layerWidth: number;
}) {
  const inner = layerWidth - spacing.base * 2;
  const left = Math.max(radius.card, Math.min(x - spacing.base, inner - radius.card)) - 8;
  return (
    <View
      pointerEvents="none"
      style={[styles.arrow, direction === 'up' ? styles.arrowUp : styles.arrowDown, { left }]}
    />
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(12, 9, 7, 0.78)' },
  ring: {
    position: 'absolute',
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  bubbleLayer: { position: 'absolute', left: 0, right: 0, paddingHorizontal: spacing.base },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.xs,
  },
  counter: { ...type.label, color: colors.muted },
  title: { ...type.rowTitle, color: colors.text },
  body: { ...type.body, color: colors.muted },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  skip: { ...type.bodySmall, color: colors.muted },
  next: {
    backgroundColor: colors.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  nextLabel: { ...type.listTitle, color: colors.ink },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUp: { borderBottomWidth: 9, borderBottomColor: colors.surface },
  arrowDown: { borderTopWidth: 9, borderTopColor: colors.surface },
});
