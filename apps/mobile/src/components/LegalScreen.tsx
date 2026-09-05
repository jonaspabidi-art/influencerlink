import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { LEGAL, type LegalSection } from '../legal';
import { colors, spacing, type } from '../theme';
import { Header, ScrollScreen } from './ui';

/**
 * Villkor och integritetspolicy delar layout.
 *
 * Sidorna måste gå att läsa utan konto: TikTok, Apple och Google öppnar dem
 * innan de granskar appen, och en besökare ska kunna läsa vad vi gör med
 * hennes uppgifter innan hon registrerar sig.
 */
export function LegalScreen({
  title,
  lead,
  sections,
}: {
  title: string;
  lead: string;
  sections: LegalSection[];
}) {
  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={title} onBack={router.canGoBack() ? () => router.back() : undefined} />

      <Text style={styles.lead}>{lead}</Text>
      <Text style={styles.updated}>Senast uppdaterad {LEGAL.updated}</Text>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.body}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bullet}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.footer}>
        {LEGAL.companyName} · {LEGAL.orgNumber} · {LEGAL.contactEmail}
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md, maxWidth: 720, width: '100%', alignSelf: 'center' },
  lead: { ...type.body, color: colors.text },
  updated: { ...type.secondary, color: colors.muted },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.sectionTitle, color: colors.text },
  body: { ...type.body, color: colors.muted },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletDot: { ...type.body, color: colors.muted },
  bullet: { ...type.body, color: colors.muted, flex: 1 },
  footer: { ...type.secondary, color: colors.dim, paddingTop: spacing.md },
});
