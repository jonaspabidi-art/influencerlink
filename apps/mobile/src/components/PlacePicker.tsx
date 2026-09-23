import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronRightIcon, CloseIcon } from './icons';
import { Button } from './ui';
import { colors, radius, spacing, type } from '../theme';

/**
 * Var man letar. En rad, inte en knapp bland tretton.
 *
 * Orten låg tidigare som ett chip bredvid nischerna, och de såg likadana ut
 * trots att de svarar på olika frågor – "var" och "vad". Man fick läsa varje
 * knapp för att förstå vilken sorts val den var.
 *
 * Orterna är fri text i databasen, så det finns ingen lista att välja ur. Det
 * som går att erbjuda är därför sökning plus de orter man använt förut, vilket
 * i praktiken är de två eller tre man faktiskt rör sig mellan.
 */
export function PlacePicker({
  city,
  recents,
  onChange,
}: {
  city: string;
  /** Orter användaren valt förut, senaste först. */
  recents: string[];
  onChange: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const choose = (next: string) => {
    onChange(next.trim());
    setQuery('');
    setOpen(false);
  };

  const suggestions = recents.filter(
    (item) => item.toLowerCase() !== city.trim().toLowerCase(),
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Byt ort. Visar ${city || 'alla orter'}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.triggerText} numberOfLines={1}>
          {city || 'Hela landet'}
        </Text>
        <View style={styles.chevron}>
          <ChevronRightIcon size={18} color={colors.muted} />
        </View>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Var letar ni?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Stäng" onPress={() => setOpen(false)} hitSlop={8}>
              <CloseIcon size={22} color={colors.muted} />
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Skriv en ort"
            placeholderTextColor={colors.dim}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => query.trim().length > 1 && choose(query)}
            accessibilityLabel="Sök ort"
          />

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
            {query.trim().length > 1 ? (
              <Row label={query.trim()} hint="Sök här" onPress={() => choose(query)} />
            ) : null}
            {suggestions.map((item) => (
              <Row key={item} label={item} onPress={() => choose(item)} />
            ))}
            <Row label="Hela landet" hint="Alla orter" onPress={() => choose('')} />
          </ScrollView>

          {query.trim().length > 1 ? (
            <Button label={`Visa ${query.trim()}`} onPress={() => choose(query)} />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function Row({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pin: { fontSize: 15 },
  triggerText: { ...type.rowTitle, color: colors.text, flexShrink: 1 },
  chevron: { transform: [{ rotate: '90deg' }] },
  pressed: { opacity: 0.85 },

  backdrop: { flex: 1, backgroundColor: 'rgba(12, 9, 7, 0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.base,
    gap: spacing.md,
    maxHeight: '75%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...type.sectionTitle, color: colors.text },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
    fontFamily: type.body.fontFamily,
    fontSize: 16,
    color: colors.text,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...type.body, color: colors.text },
  rowHint: { ...type.secondary, color: colors.muted },
});
