import { useQuery } from '@tanstack/react-query';
import { myCampaignsQuery, retainersQuery } from '../../src/queries';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { DemoBanner } from '../../src/components/DemoBanner';
import { ExpertOrderStatus } from '../../src/components/ExpertOrderStatus';
import { PlusIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Button,
  Card,
  Divider,
  ErrorState,
  Header,
  Label,
  Loading,
  Screen,
  StatusBadge,
  type StatusTone,
} from '../../src/components/ui';
import { describeCompensation, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Campaign, Retainer } from '../../src/types';

const STATUS_LABELS: Record<Campaign['status'], string> = {
  DRAFT: 'Utkast',
  ACTIVE: 'Publicerad',
  PAUSED: 'Pausad',
  CLOSED: 'Avslutad',
};

const STATUS_TONES: Record<Campaign['status'], StatusTone> = {
  DRAFT: 'pending',
  ACTIVE: 'active',
  PAUSED: 'pending',
  CLOSED: 'cancelled',
};

const RETAINER_LABELS: Record<Retainer['status'], string> = {
  REQUESTED: 'Väntar på svar',
  DECLINED: 'Tackade nej',
  ACTIVE: 'Pågår',
  CANCELLING: 'Avslutas efter månaden',
  ENDED: 'Avslutat',
};

/**
 * Företagets uppdrag.
 *
 * De två sätten att jobba med en kreatör låg tidigare i olika flikar: en
 * kampanj under Kampanjer, ett löpande uppdrag under Avtal. Två produkter på
 * två orelaterade ställen, och ingen av platserna nämnde att den andra fanns –
 * så företaget kunde inte se att det ens gick att välja.
 *
 * Nu ligger de bredvid varandra under egna rubriker, och skillnaden står
 * skriven där valet görs i stället för att behöva räknas ut.
 */
export default function BusinessAssignments() {
  const router = useRouter();
  const campaigns = useQuery(myCampaignsQuery());
  const retainers = useQuery(retainersQuery());

  if (campaigns.isLoading) {
    return (
      <Screen>
        <Header title="Uppdrag" large />
        <Loading />
      </Screen>
    );
  }
  if (campaigns.isError) {
    return (
      <Screen>
        <Header title="Uppdrag" large />
        <ErrorState
          message="Kunde inte hämta uppdragen."
          onRetry={() => void campaigns.refetch()}
        />
      </Screen>
    );
  }

  const data = campaigns.data ?? [];
  const running = (retainers.data ?? []).filter(
    (retainer) =>
      retainer.status === 'REQUESTED' ||
      retainer.status === 'ACTIVE' ||
      retainer.status === 'CANCELLING',
  );

  if (data.length === 0 && running.length === 0) {
    return (
      <Screen>
        <Header title="Uppdrag" large subtitle="Inget samarbete ännu" />
        <View style={styles.emptyBody}>
          <ExpertOrderStatus />
          <Choice expanded />
          <DemoBanner />
        </View>
      </Screen>
    );
  }

  const published = data.filter((item) => item.status === 'ACTIVE').length;

  return (
    <Screen>
      <Header
        title="Uppdrag"
        large
        subtitle={[
          published > 0 ? `${published} ${published === 1 ? 'kampanj' : 'kampanjer'}` : null,
          running.length > 0 ? `${running.length} löpande` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <FlatList
        data={data}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ExpertOrderStatus />
            <Choice />

            {running.length > 0 ? (
              <View style={styles.section}>
                <Label>LÖPANDE UPPDRAG</Label>
                {running.map((retainer) => (
                  <Pressable
                    key={retainer.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/retainer/${retainer.id}`)}
                    style={({ pressed }) => [styles.retainerRow, pressed && styles.pressed]}
                  >
                    <Avatar
                      uri={retainer.influencerAvatarUrl}
                      name={retainer.influencerName}
                      size={40}
                    />
                    <View style={styles.retainerText}>
                      <Text style={styles.title} numberOfLines={1}>
                        {retainer.influencerName}
                      </Text>
                      <Text style={styles.secondary}>
                        {retainer.videosPerMonth} videor i månaden till era kanaler
                      </Text>
                      <Text
                        style={[
                          styles.status,
                          {
                            color:
                              retainer.status === 'ACTIVE' ? colors.positive : colors.accent,
                          },
                        ]}
                      >
                        {RETAINER_LABELS[retainer.status]}
                      </Text>
                    </View>
                    <Text style={styles.amount}>
                      {formatSek(Math.round(retainer.monthlyRate * 1.1))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {data.length > 0 ? <Label>ENGÅNGSKAMPANJER</Label> : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <DemoBanner />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.title}</Text>
              <StatusBadge label={STATUS_LABELS[item.status]} tone={STATUS_TONES[item.status]} />
            </View>
            <Text style={styles.amount}>
              {describeCompensation(
                item.compensationType,
                item.budgetPerCreator,
                item.productValue,
                formatSek,
              )}
            </Text>
            <Text style={styles.secondary}>
              {item.slotsFilled} av {item.slots} platser fyllda · {item.city}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/campaign/${item.id}`)}
                hitSlop={8}
              >
                <Text style={styles.link}>Hantera</Text>
              </Pressable>
              {item.status === 'ACTIVE' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/discover/${item.id}`)}
                  hitSlop={8}
                >
                  <Text style={styles.link}>Hitta influencers</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

/**
 * De två sätten, sida vid sida.
 *
 * Skillnaden är inte storleken utan vems kanal innehållet går ut på, och det
 * är det enda som avgör vilket av dem en krögare vill ha. Den som redan har
 * uppdrag igång behöver inte läsa det varje gång, så jämförelsen ligger
 * hopfälld – men i tomma läget står den öppen, för då är det just det valet
 * man ska göra.
 */
function Choice({ expanded = false }: { expanded?: boolean }) {
  const router = useRouter();

  return (
    <Card>
      <Text style={styles.choiceTitle}>Två sätt att jobba med kreatörer</Text>

      <View style={styles.option}>
        <Text style={styles.optionTitle}>Kampanj</Text>
        <Text style={styles.optionLead}>
          Kreatören lägger upp på sin egen kanal, inför sina följare.
        </Text>
        {expanded ? (
          <Body>
            En video, ett tillfälle. Bra för att synas snabbt eller testa om det funkar – och ni
            får filmen att använda själva. Från ungefär 2 500 kr en gång.
          </Body>
        ) : null}
        <Button
          label="Skapa kampanj"
          icon={<PlusIcon size={18} color={colors.ink} />}
          onPress={() => router.push('/campaign/new')}
        />
      </View>

      <Divider />

      <View style={styles.option}>
        <Text style={styles.optionTitle}>Löpande uppdrag</Text>
        <Text style={styles.optionLead}>
          Kreatören producerar åt era egna kanaler, varje månad.
        </Text>
        {expanded ? (
          <Body>
            Fyra till tolv videor i månaden på ert eget konto, som ni godkänner innan de läggs
            upp. Bygger något som blir ert. Från ungefär 6 000 kr i månaden, ingen bindningstid.
          </Body>
        ) : null}
        <Button
          label="Hitta någon som jobbar löpande"
          variant="secondary"
          onPress={() => router.push('/business/discover?retainers=1')}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  section: { gap: spacing.sm },
  list: { gap: 10, paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: 6,
  },
  pressed: { opacity: 0.9 },
  retainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  retainerText: { flex: 1, gap: 2 },
  status: { fontFamily: type.listTitle.fontFamily, fontSize: 13 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, fontSize: 16, color: colors.text, flex: 1 },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 17, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted },

  choiceTitle: { ...type.sectionTitle, color: colors.text },
  option: { gap: spacing.sm },
  optionTitle: { ...type.listTitle, fontSize: 16, color: colors.text },
  optionLead: { ...type.bodySmall, color: colors.text },

  actions: { flexDirection: 'row', gap: spacing.base, paddingTop: 2 },
  link: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
  footer: { paddingTop: spacing.md },
  emptyBody: { flex: 1, paddingHorizontal: spacing.base, gap: 14 },
});
