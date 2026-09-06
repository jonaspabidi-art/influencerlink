import { Children, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRating, type RatingSummary } from '@pacta/shared';
import { resolveMediaUrl } from '../media';
import { HEIGHTS, HIT_SLOP, colors, radius, spacing, type } from '../theme';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, StarIcon } from './icons';

// --- Ytor -------------------------------------------------------------------

export function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
  avoidKeyboard = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Array<'top' | 'bottom'>;
  /** För skärmar med textfält längst ned, t.ex. chatten. */
  avoidKeyboard?: boolean;
}) {
  const body = <View style={[styles.screenBody, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {avoidKeyboard ? <KeyboardAvoider>{body}</KeyboardAvoider> : body}
    </SafeAreaView>
  );
}

/**
 * Tangentbordet täcker annars fälten längst ned på en telefon. iOS behöver
 * padding, Android hanterar det själv via windowSoftInputMode och ska inte
 * få dubbel kompensation.
 */
function KeyboardAvoider({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.screenBody}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** Skärm med rullande innehåll. Sidmarginal 16, som i handoffen. */
export function ScrollScreen({
  children,
  contentStyle,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Array<'top' | 'bottom'>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoider>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

/** Skärmrubrik med valfri underrubrik, tillbakapil och högerslot. */
export function Header({
  title,
  subtitle,
  onBack,
  right,
  large = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** 24/700 i stället för 17/600 – används på flikarnas toppnivå. */
  large?: boolean;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tillbaka"
          onPress={onBack}
          style={styles.backButton}
        >
          <ChevronLeftIcon size={22} color={colors.muted} />
        </Pressable>
      ) : null}
      <View style={styles.headerText}>
        <Text style={large ? styles.screenTitle : styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.secondary}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** surface = vit yta med kant, raised = förklarande panel, primary/positive = markerad. */
  tone?: 'surface' | 'raised' | 'primary' | 'positive';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'surface' && styles.cardSurface,
        tone === 'raised' && styles.cardRaised,
        tone === 'primary' && styles.cardPrimary,
        tone === 'positive' && styles.cardPositive,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Divider = () => <View style={styles.divider} />;

// --- Text -------------------------------------------------------------------

export const ScreenTitle = ({ children }: { children: ReactNode }) => (
  <Text style={styles.screenTitle}>{children}</Text>
);

export const Display = ({ children, center }: { children: ReactNode; center?: boolean }) => (
  <Text style={[styles.display, center && styles.center]}>{children}</Text>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

export const RowTitle = ({ children }: { children: ReactNode }) => (
  <Text style={styles.rowTitle}>{children}</Text>
);

export const Body = ({
  children,
  muted = true,
  center,
}: {
  children: ReactNode;
  muted?: boolean;
  center?: boolean;
}) => (
  <Text style={[styles.body, muted && styles.mutedText, center && styles.center]}>{children}</Text>
);

export const Secondary = ({ children }: { children: ReactNode }) => (
  <Text style={styles.secondary}>{children}</Text>
);

/** Liten versal etikett i monospace, t.ex. SIGNERAT eller AVTALSTEXT. */
export const Label = ({ children }: { children: ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Amount = ({
  children,
  tone = 'accent',
  size = 'card',
}: {
  children: ReactNode;
  tone?: 'accent' | 'positive' | 'text';
  size?: 'card' | 'large' | 'hero';
}) => (
  <Text
    style={[
      size === 'hero' ? styles.amountHero : size === 'large' ? styles.amountLarge : styles.amount,
      tone === 'accent' && styles.accentText,
      tone === 'positive' && styles.positiveText,
    ]}
  >
    {children}
  </Text>
);

// --- Knappar ----------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /** 48 i stället för 52 – används inuti rollkorten på inloggningen. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { height: compact ? HEIGHTS.buttonCompact : HEIGHTS.buttonPrimary },
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text
            style={
              variant === 'primary' ? styles.buttonLabelPrimary : styles.buttonLabelSecondary
            }
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Rund ikonknapp i headern, 44 × 44. */
export function IconButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** Kvadratisk ikonruta 44 × 44 med rundade hörn, t.ex. rollkortens ikon. */
export function IconBox({ children, tone = 'raised' }: { children: ReactNode; tone?: 'raised' | 'tint' }) {
  return (
    <View style={[styles.iconBox, tone === 'tint' && styles.iconBoxTint]}>{children}</View>
  );
}

/**
 * Menyrad med ikon, etikett och pil. `MenuGroup` sätter dem i ett kort med
 * hårlinjer emellan, som i de appar kreatörerna redan använder – hela raden är
 * tryckyta, inte bara texten.
 */
export function MenuGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.menuGroup}>
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? <View style={styles.menuDivider} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}

export function MenuRow({
  icon,
  label,
  hint,
  onPress,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  /** Kort värde till höger om etiketten, t.ex. antal eller status. */
  hint?: string;
  onPress: () => void;
  /** 'danger' färgar etiketten röd – används för att logga ut. */
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={tone === 'danger' ? styles.menuLabelDanger : styles.menuLabel}>{label}</Text>
      {hint ? <Text style={styles.secondary}>{hint}</Text> : null}
      {/* Pilen betyder "här finns mer". En handling som loggar ut leder ingenstans. */}
      {tone === 'danger' ? null : <ChevronRightIcon size={18} color={colors.dim} />}
    </Pressable>
  );
}

// --- Taggar, chips och märken ------------------------------------------------

export function Tag({ label, tone = 'filled' }: { label: string; tone?: 'filled' | 'outline' | 'dashed' }) {
  return (
    <View
      style={[
        styles.tag,
        tone === 'filled' && styles.tagFilled,
        tone === 'outline' && styles.tagOutline,
        tone === 'dashed' && styles.tagDashed,
      ]}
    >
      <Text style={[styles.tagLabel, tone === 'dashed' && styles.mutedText]}>{label}</Text>
    </View>
  );
}

/** Valbart nischchip: fyllt i primärfärg när det är valt, annars outline. */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}>
      <Text style={selected ? styles.chipLabelSelected : styles.chipLabel}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {content}
    </Pressable>
  );
}

/** Matchningspill: bg-färgad platta med accentkant, gnista och procent. */
export function MatchPill({ score, icon }: { score: number; icon?: ReactNode }) {
  return (
    <View style={styles.matchPill}>
      {icon}
      <Text style={styles.matchPillLabel}>{Math.round(score)} % match</Text>
    </View>
  );
}

export type StatusTone = 'pending' | 'active' | 'done' | 'cancelled';

/** Statusmärke i headern på avtalsvyn. */
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  if (tone === 'done') {
    return (
      <View style={[styles.statusBadge, styles.statusDone]}>
        <CheckIcon size={13} color={colors.bg} />
        <Text style={styles.statusDoneLabel}>{label}</Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'pending' && styles.statusPending,
        tone === 'active' && styles.statusActive,
        tone === 'cancelled' && styles.statusCancelled,
      ]}
    >
      <Text
        style={[
          styles.statusLabel,
          tone === 'pending' && styles.accentText,
          tone === 'active' && styles.positiveText,
          tone === 'cancelled' && styles.dangerText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Nyckeltalsruta: versal etikett över ett värde. */
export function StatBox({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: 'text' | 'positive' | 'accent';
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          tone === 'positive' && styles.positiveText,
          tone === 'accent' && styles.accentText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Rad med etikett till vänster och värde till höger, som i ekonomikortet. */
export function DetailRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  /** Större och i accentfärg – används för "Till kreatören". */
  emphasis?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={emphasis ? styles.detailLabelEmphasis : styles.detailLabel}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={emphasis ? styles.detailValueEmphasis : styles.detailValue}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Trygghetsraden: hänglås plus en mening om att pengarna ligger spärrade. */
export function TrustBar({ text }: { text: string }) {
  return (
    <View style={styles.trustBar}>
      <LockIcon size={14} color={colors.positive} />
      <Text style={styles.secondary}>{text}</Text>
    </View>
  );
}

// --- Betyg ------------------------------------------------------------------

/** Fem stjärnor, halvfyllda när medelbetyget hamnar mitt emellan. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2, 3, 4].map((index) => {
        const filled = value - index;
        return (
          <StarIcon
            key={index}
            size={size}
            variant={filled >= 0.75 ? 'full' : filled >= 0.25 ? 'half' : 'empty'}
          />
        );
      })}
    </View>
  );
}

/**
 * Betyget som det visas på kort och i listor. Utan omdömen visas ingenting –
 * en tom stjärnrad läser som betyget noll, och en ny profil är inte dålig.
 */
export function Rating({
  summary,
  size = 13,
  showCount = true,
  emptyLabel,
}: {
  summary: RatingSummary;
  size?: number;
  showCount?: boolean;
  /** Text när det inte finns några omdömen. Utelämnad = visa inget alls. */
  emptyLabel?: string;
}) {
  if (summary.count === 0) {
    return emptyLabel ? <Text style={styles.ratingEmpty}>{emptyLabel}</Text> : null;
  }
  return (
    <View
      style={styles.ratingRow}
      accessibilityLabel={`Betyg ${formatRating(summary.average)} av 5, ${summary.count} omdömen`}
    >
      <Stars value={summary.average} size={size} />
      <Text style={[styles.ratingValue, { fontSize: size }]}>{formatRating(summary.average)}</Text>
      {showCount ? <Text style={styles.ratingCount}>({summary.count})</Text> : null}
    </View>
  );
}

/** Stjärnrad att trycka på. Varje stjärna har full träffyta enligt handoffen. */
export function RatingInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <View style={styles.ratingInput}>
      {[1, 2, 3, 4, 5].map((score) => (
        <Pressable
          key={score}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === score }}
          accessibilityLabel={`${label}: ${score} av 5`}
          hitSlop={HIT_SLOP}
          onPress={() => onChange(score)}
          style={({ pressed }) => [styles.ratingStar, pressed && styles.pressed]}
        >
          <StarIcon size={30} variant={score <= value ? 'full' : 'empty'} />
        </Pressable>
      ))}
    </View>
  );
}

/** Fördelningen på en profil: fem staplar, fem stjärnor överst. */
export function RatingBars({ summary }: { summary: RatingSummary }) {
  const max = Math.max(1, ...summary.distribution);
  return (
    <View style={styles.ratingBars}>
      {[5, 4, 3, 2, 1].map((step) => {
        const count = summary.distribution[step - 1] ?? 0;
        return (
          <View key={step} style={styles.ratingBarRow}>
            <Text style={styles.ratingBarLabel}>{step}</Text>
            <View style={styles.ratingBarTrack}>
              <View style={[styles.ratingBarFill, { flex: count / max }]} />
              <View style={{ flex: 1 - count / max }} />
            </View>
            <Text style={styles.ratingBarCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

// --- Bilder -----------------------------------------------------------------

/**
 * Bildyta. Finns ingen bild blir det en tom photo-färgad yta utan ikon och
 * text, precis som handoffen säger – kortet håller ändå eftersom bildytan är
 * den som flexar.
 */
/**
 * Bildyta med reservläge.
 *
 * Utan bild fylls ytan med en ton som är samma varje gång för samma namn. En
 * grå tom yta får kortet att se ofärdigt ut; en färgad ser gjord ut. Bokstäver
 * står här emot: i den här storleken läser man dem som en platshållare, och
 * kortets rubrik står ändå strax under.
 */
export function Photo({
  uri,
  name,
  style,
  children,
}: {
  uri?: string | null;
  /** Namnet initialerna hämtas ur när bild saknas. */
  name?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const resolved = resolveMediaUrl(uri);
  return (
    <View style={[styles.photo, !resolved && name ? monogramTone(name) : null, style]}>
      {resolved ? (
        <Image source={{ uri: resolved }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      {children}
    </View>
  );
}

/** Två bokstäver ur namnet: "Restaurang Kajutan" blir RK, "annaäter" blir AN. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2).toUpperCase();
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
}

/** Samma namn ger alltid samma ton, så en profil ser likadan ut överallt. */
const MONOGRAM_TONES = ['#E7D9C8', '#DCE3D6', '#E9D6D2', '#D9DEE7', '#EAE0CC', '#DDD8E5'];

function monogramTone(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 100_003;
  }
  return { backgroundColor: MONOGRAM_TONES[hash % MONOGRAM_TONES.length] };
}

/** Logotypruta 48 × 48 med radius 8. */
export function Logo({
  uri,
  name,
  size = 48,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) {
  const resolved = resolveMediaUrl(uri);
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size },
        !resolved && name ? monogramTone(name) : null,
      ]}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : name ? (
        <Text style={[styles.monogram, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      ) : null}
    </View>
  );
}

/**
 * Rund avatar. `ring` lägger till den 4 px breda bakgrundsfärgade ramen som
 * skiljer bilderna från varandra när de överlappar på matchningsskärmen.
 */
export function Avatar({
  uri,
  name,
  size = 52,
  ring = false,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
}) {
  const resolved = resolveMediaUrl(uri);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        !resolved && name ? monogramTone(name) : null,
        ring && styles.avatarRing,
      ]}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : name ? (
        <Text style={[styles.monogram, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      ) : null}
    </View>
  );
}

// --- Formulär ---------------------------------------------------------------

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  secure = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** 'url' används även för användarnamn: gemener, ingen autokorrigering. */
  keyboardType?: 'default' | 'numeric' | 'email' | 'url';
  /** Döljer texten och stänger av autokorrigering, för lösenord. */
  secure?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Label>{label.toUpperCase()}</Label>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        multiline={multiline}
        keyboardType={keyboardType === 'email' ? 'email-address' : keyboardType}
        autoCapitalize={keyboardType === 'default' && !secure ? 'sentences' : 'none'}
        autoCorrect={!secure && keyboardType !== 'url'}
        secureTextEntry={secure}
        accessibilityLabel={label}
      />
      {hint ? <Text style={styles.secondary}>{hint}</Text> : null}
    </View>
  );
}

/** Segmenterat val, 40 px högt, valt segment fyllt i primärfärg. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={selected ? styles.segmentLabelSelected : styles.segmentLabel}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Framstegsindikator: staplar där de avklarade är i primärfärg. */
export function Progress({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.progressBar, index < current && styles.progressBarDone]}
        />
      ))}
    </View>
  );
}

// --- Lägen ------------------------------------------------------------------

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.secondary}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.body, styles.center]}>{message}</Text>
      {onRetry ? <Button label="Försök igen" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenBody: { flex: 1 },
  scrollContent: { padding: spacing.base, gap: spacing.md, paddingBottom: spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  headerTitle: { ...type.rowTitleMedium, color: colors.text },
  screenTitle: { ...type.screenTitle, color: colors.text },

  card: { borderRadius: radius.card, padding: spacing.base, gap: spacing.md },
  cardSurface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardRaised: { backgroundColor: colors.raised },
  cardPrimary: { borderWidth: 1, borderColor: colors.primary },
  cardPositive: { borderWidth: 1, borderColor: colors.positive },
  divider: { height: 1, backgroundColor: colors.border },

  display: { ...type.display, color: colors.text },
  sectionTitle: { ...type.sectionTitle, color: colors.text },
  rowTitle: { ...type.rowTitle, color: colors.text },
  body: { ...type.body, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  label: { ...type.label, color: colors.muted },
  mutedText: { color: colors.muted },
  accentText: { color: colors.accent },
  positiveText: { color: colors.positive },
  dangerText: { color: colors.danger },
  center: { textAlign: 'center' },

  amount: { ...type.amount, color: colors.text },
  amountLarge: { ...type.amountLarge, color: colors.text },
  amountHero: { ...type.amountHero, color: colors.text },

  button: {
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  buttonLabelPrimary: { ...type.buttonPrimary, color: colors.ink },
  buttonLabelSecondary: { ...type.buttonSecondary, color: colors.text },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxTint: { backgroundColor: colors.tint },

  menuGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  menuIcon: { width: 24, alignItems: 'center' },
  menuLabel: { ...type.rowTitle, color: colors.text, flex: 1 },
  menuLabelDanger: { ...type.rowTitle, color: colors.danger, flex: 1 },

  tag: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.tag },
  tagFilled: { backgroundColor: colors.raised },
  tagOutline: { borderWidth: 1, borderColor: colors.border },
  tagDashed: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  tagLabel: { ...type.secondary, color: colors.text },

  chip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: radius.chip },
  chipUnselected: { borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary },
  chipLabel: { ...type.bodySmall, color: colors.text },
  chipLabelSelected: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.ink },

  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.tag,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  matchPillLabel: { fontFamily: type.rowTitle.fontFamily, fontSize: 13, color: colors.accent },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.tag,
  },
  statusPending: { borderWidth: 1, borderColor: colors.accent },
  statusActive: { borderWidth: 1, borderColor: colors.positive },
  statusCancelled: { borderWidth: 1, borderColor: colors.danger },
  statusDone: { backgroundColor: colors.positive },
  statusLabel: { fontFamily: type.rowTitle.fontFamily, fontSize: 12 },
  statusDoneLabel: { fontFamily: type.rowTitle.fontFamily, fontSize: 12, color: colors.bg },

  statBox: {
    flex: 1,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { fontFamily: type.label.fontFamily, fontSize: 10, letterSpacing: 0.6, color: colors.muted },
  statValue: { fontFamily: type.rowTitle.fontFamily, fontSize: 18, color: colors.text },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  detailLabel: { ...type.body, color: colors.muted },
  detailValue: { fontFamily: type.listTitle.fontFamily, fontSize: 15, color: colors.text, textAlign: 'right', flexShrink: 1 },
  detailLabelEmphasis: { fontFamily: type.listTitle.fontFamily, fontSize: 15, color: colors.text },
  detailValueEmphasis: { ...type.amountSmall, color: colors.accent },

  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  stars: { flexDirection: 'row', gap: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingValue: { fontFamily: type.listTitle.fontFamily, color: colors.text },
  ratingCount: { ...type.secondary, fontSize: 12, color: colors.muted },
  ratingEmpty: { ...type.secondary, fontSize: 12, color: colors.dim },
  ratingInput: { flexDirection: 'row', gap: spacing.sm },
  ratingStar: { padding: 6 },
  ratingBars: { gap: 6 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ratingBarLabel: { ...type.secondary, color: colors.muted, width: 10 },
  ratingBarTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  ratingBarFill: { backgroundColor: colors.accent },
  ratingBarCount: { ...type.secondary, color: colors.muted, width: 22, textAlign: 'right' },

  photo: { backgroundColor: colors.photo, overflow: 'hidden' },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: colors.raised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: { fontFamily: type.rowTitle.fontFamily, color: colors.muted },

  avatarRing: { borderWidth: 4, borderColor: colors.bg },

  field: { gap: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontFamily: type.body.fontFamily,
    // Minst 16 px. Safari på iPhone zoomar in på ett fält med mindre text när
    // det får fokus, och sidan hoppar då till dubbel storlek.
    fontSize: 16,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },

  segmented: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentLabel: { ...type.secondary, color: colors.muted },
  segmentLabelSelected: { fontFamily: type.listTitle.fontFamily, fontSize: 13, color: colors.ink },

  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressBarDone: { backgroundColor: colors.primary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});

export { styles as uiStyles };
export type { TextStyle };
