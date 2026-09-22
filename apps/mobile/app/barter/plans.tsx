import { BARTER_PLAN_SPECS, SELLABLE_BARTER_PLANS } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Body, Card, Header, ScrollScreen, Tag } from '../../src/components/ui';
import { CheckIcon } from '../../src/components/icons';
import { formatSek } from '../../src/format';
import { LEGAL } from '../../src/legal';
import { barterQuery } from '../../src/queries';
import { colors, spacing, type } from '../../src/theme';

/**
 * Nivåerna för mat mot innehåll.
 *
 * Ingen köpknapp än. Faktureringen sker utanför appen tills det finns
 * abonnenter nog att motivera återkommande betalningar – en knapp som säger
 * "köp" och sedan öppnar ett mejlprogram är sämre än en rad som säger hur det
 * går till.
 */
export default function BarterPlans() {
  const router = useRouter();
  const status = useQuery(barterQuery());
  const current = status.data?.plan ?? 'NONE';

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Mat mot innehåll" onBack={() => router.back()} />

      <Body>
        Lägg upp uppdrag där ersättningen är en måltid i stället för pengar. Det passar
        kreatörer som bygger upp sin portfölj, och er som vill ha innehåll utan kampanjbudget.
      </Body>

      {SELLABLE_BARTER_PLANS.map((plan) => {
        const spec = BARTER_PLAN_SPECS[plan];
        const active = current === plan;
        return (
          <Card key={plan} tone={active ? 'primary' : 'surface'}>
            <View style={styles.head}>
              <Text style={styles.name}>{spec.label}</Text>
              {active ? <Tag label="Er nivå" /> : null}
            </View>
            <Text style={styles.price}>{formatSek(spec.monthlyPrice)} / månad</Text>
            <Body>{spec.lead}</Body>
            <View style={styles.bullet}>
              <CheckIcon size={16} color={colors.positive} />
              <Text style={styles.bulletText}>
                {spec.monthlyCollabs} samarbeten i månaden
              </Text>
            </View>
            <View style={styles.bullet}>
              <CheckIcon size={16} color={colors.positive} />
              <Text style={styles.bulletText}>Ingen bindningstid</Text>
            </View>
          </Card>
        );
      })}

      <Card tone="raised">
        <Text style={styles.name}>Så kommer ni igång</Text>
        <Body>
          Hör av er till {LEGAL.contactEmail} med företagsnamn och vilken nivå ni vill ha, så
          skickar vi en faktura och slår på den. Uppsägning sker på samma sätt.
        </Body>
      </Card>

      <Text style={styles.footnote}>
        Kreatören får mat eller ett besök i stället för arvode. Inga pengar går via Pacta i de
        här uppdragen, och kreatören svarar själv för sin skatt.
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.rowTitle, color: colors.text },
  price: { ...type.amountSmall, color: colors.accent },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletText: { ...type.bodySmall, color: colors.muted, flex: 1 },
  footnote: { ...type.secondary, color: colors.muted },
});
