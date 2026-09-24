import { BARTER_PLAN_SPECS } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { barterQuery, myCampaignsQuery, retainersQuery } from '../../src/queries';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DemoBanner } from '../../src/components/DemoBanner';
import { ExpertOrderStatus } from '../../src/components/ExpertOrderStatus';
import { ChevronRightIcon, PlusIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Button,
  ErrorState,
  Header,
  IconButton,
  Loading,
  Screen,
  StatusBadge,
  type StatusTone,
} from '../../src/components/ui';
import { describeCompensation, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import { useTourAnchor } from '../../src/tour/Tour';
import type { BarterStatus, Campaign, Retainer } from '../../src/types';

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

type SectionKey = 'barter' | 'campaigns' | 'retainers';

/**
 * Allt ett företag har lagt ut, på ett ställe.
 *
 * Tre sätt att jobba med kreatörer ryms här: mat mot innehåll,
 * engångskampanjer och löpande uppdrag. Att ge dem var sin flik hade gjort
 * flikraden obegriplig, och att rada dem under varandra gjorde sidan lång och
 * mosig. Därför är de hopfällbara: stängd visar en sektion en rad om vad som
 * finns, öppen visar innehållet och den enda knapp som hör dit.
 *
 * Exakt en är öppen i taget. Två öppna sektioner är en lista igen.
 */
export default function BusinessAssignments() {
  const router = useRouter();
  const campaigns = useQuery(myCampaignsQuery());
  const retainers = useQuery(retainersQuery());
  const barter = useQuery(barterQuery());
  const newCampaignAnchor = useTourAnchor('business.newCampaign');

  const [open, setOpen] = useState<SectionKey | null>(null);

  const newCampaign = (
    <View ref={newCampaignAnchor.ref}>
      <IconButton label="Ny kampanj" onPress={() => router.push('/campaign/new')}>
        <PlusIcon size={20} color={colors.text} />
      </IconButton>
    </View>
  );

  if (campaigns.isLoading) {
    return (
      <Screen>
        <Header title="Uppdrag" large right={newCampaign} />
        <Loading />
      </Screen>
    );
  }
  if (campaigns.isError) {
    return (
      <Screen>
        <Header title="Uppdrag" large right={newCampaign} />
        <ErrorState
          message="Kunde inte hämta uppdragen."
          onRetry={() => void campaigns.refetch()}
        />
      </Screen>
    );
  }

  const all = campaigns.data ?? [];
  const barterCampaigns = all.filter((item) => item.compensationType === 'PRODUCT');
  const paidCampaigns = all.filter((item) => item.compensationType !== 'PRODUCT');
  const running = (retainers.data ?? []).filter(
    (retainer) =>
      retainer.status === 'REQUESTED' ||
      retainer.status === 'ACTIVE' ||
      retainer.status === 'CANCELLING',
  );

  /*
   * Vilken sektion som står öppen när sidan öppnas.
   *
   * Den första som har något att visa, annars mat mot innehåll – det är den
   * billigaste vägen in och därmed rätt förstahandsförslag för ett ställe som
   * inte lagt ut något än.
   */
  const initial: SectionKey =
    barterCampaigns.length > 0
      ? 'barter'
      : paidCampaigns.length > 0
        ? 'campaigns'
        : running.length > 0
          ? 'retainers'
          : 'barter';
  const active = open ?? initial;
  const toggle = (key: SectionKey) => setOpen((current) => ((current ?? initial) === key ? null : key));

  const published = paidCampaigns.filter((item) => item.status === 'ACTIVE').length;

  return (
    <Screen>
      <Header
        title="Uppdrag"
        large
        right={newCampaign}
        subtitle={[
          published > 0 ? `${published} ${published === 1 ? 'kampanj' : 'kampanjer'}` : null,
          barterCampaigns.length > 0 ? `${barterCampaigns.length} mot mat` : null,
          running.length > 0 ? `${running.length} löpande` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Inget uppdrag ännu'}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ExpertOrderStatus />

        <Section
          title="Mat mot innehåll"
          summary={barterSummary(barter.data, barterCampaigns.length)}
          open={active === 'barter'}
          onToggle={() => toggle('barter')}
        >
          <Body>
            Uppdrag där ersättningen är en måltid i stället för arvode. Passar kreatörer som
            bygger upp sin portfölj.
          </Body>
          {barter.data ? <BarterMeter status={barter.data} /> : null}
          {barterCampaigns.map((item) => (
            <CampaignRow key={item.id} campaign={item} />
          ))}
          {barter.data?.plan === 'NONE' ? (
            <Button label="Se nivåer och priser" onPress={() => router.push('/barter/plans')} />
          ) : (
            <>
              <Button
                label="Nytt uppdrag mot mat"
                icon={<PlusIcon size={18} color={colors.ink} />}
                onPress={() => router.push('/campaign/new')}
              />
              <Button
                label="Byt nivå"
                variant="secondary"
                onPress={() => router.push('/barter/plans')}
              />
            </>
          )}
        </Section>

        <Section
          title="Engångskampanjer"
          summary={
            paidCampaigns.length === 0
              ? 'Inga ännu'
              : `${paidCampaigns.length} st · ${published} publicerade`
          }
          open={active === 'campaigns'}
          onToggle={() => toggle('campaigns')}
        >
          <Body>
            Ett jobb i taget, med arvode. Kreatören lägger upp på sin egen kanal, inför sina
            följare.
          </Body>
          {paidCampaigns.map((item) => (
            <CampaignRow key={item.id} campaign={item} />
          ))}
          <Button
            label="Ny kampanj"
            icon={<PlusIcon size={18} color={colors.ink} />}
            onPress={() => router.push('/campaign/new')}
          />
        </Section>

        <Section
          title="Löpande uppdrag"
          summary={running.length === 0 ? 'Ingen jobbar löpande än' : `${running.length} pågående`}
          open={active === 'retainers'}
          onToggle={() => toggle('retainers')}
        >
          <Body>
            En kreatör producerar innehåll till era egna kanaler varje månad. Från 6 000 kr i
            månaden, ingen bindningstid.
          </Body>
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
                    { color: retainer.status === 'ACTIVE' ? colors.positive : colors.accent },
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
          <Button
            label={running.length === 0 ? 'Så funkar det' : 'Hitta någon mer'}
            variant={running.length === 0 ? 'primary' : 'secondary'}
            onPress={() => router.push('/retainer/start')}
          />
        </Section>

        <DemoBanner />
      </ScrollView>
    </Screen>
  );
}

/** Raden som står när sektionen är stängd. */
function barterSummary(status: BarterStatus | undefined, campaigns: number): string {
  if (!status || status.plan === 'NONE') return 'Kräver abonnemang';
  const spec = BARTER_PLAN_SPECS[status.plan];
  const left = `${status.remaining} av ${status.limit} kvar i månaden`;
  return campaigns === 0 ? `${spec.label} · ${left}` : `${campaigns} uppdrag · ${left}`;
}

/** Hopfällbar sektion: en rad stängd, innehåll och en knapp öppen. */
function Section({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
      >
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.secondary}>{summary}</Text>
        </View>
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronRightIcon size={20} color={colors.muted} />
        </View>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

/** Hur mycket av månadens tak som är använt. */
function BarterMeter({ status }: { status: BarterStatus }) {
  const filled = status.limit === 0 ? 0 : Math.min(1, status.used / status.limit);
  return (
    <View style={styles.meterBox}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>{BARTER_PLAN_SPECS[status.plan].label}</Text>
        <Text style={styles.secondary}>
          {status.used} av {status.limit} använda
        </Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { flex: filled }]} />
        <View style={{ flex: 1 - filled }} />
      </View>
      {status.blocker ? <Text style={styles.blocker}>{status.blocker}</Text> : null}
      {status.pastDue ? (
        <Text style={styles.blocker}>
          Senaste dragningen gick inte igenom. Byt kort under Mat mot innehåll.
        </Text>
      ) : null}
    </View>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.title}>{campaign.title}</Text>
        <StatusBadge
          label={STATUS_LABELS[campaign.status]}
          tone={STATUS_TONES[campaign.status]}
        />
      </View>
      <Text style={styles.amount}>
        {describeCompensation(
          campaign.compensationType,
          campaign.budgetPerCreator,
          campaign.productValue,
          formatSek,
        )}
      </Text>
      <Text style={styles.secondary}>
        {campaign.slotsFilled} av {campaign.slots} platser fyllda · {campaign.city}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/campaign/${campaign.id}`)}
          hitSlop={8}
        >
          <Text style={styles.link}>Hantera</Text>
        </Pressable>
        {campaign.status === 'ACTIVE' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/discover/${campaign.id}`)}
            hitSlop={8}
          >
            <Text style={styles.link}>Hitta influencers</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  sectionText: { flex: 1, gap: 2 },
  sectionTitle: { ...type.rowTitle, color: colors.text },
  sectionBody: {
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  pressed: { opacity: 0.9 },

  meterBox: { gap: spacing.sm, backgroundColor: colors.raised, borderRadius: radius.card, padding: spacing.md },
  meterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterLabel: { ...type.listTitle, color: colors.text },
  meterTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.round,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  meterFill: { backgroundColor: colors.primary },
  blocker: { ...type.secondary, color: colors.muted },

  row: {
    backgroundColor: colors.raised,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: 6,
  },
  retainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.raised,
    borderRadius: radius.card,
    padding: spacing.base,
  },
  retainerText: { flex: 1, gap: 2 },
  status: { fontFamily: type.listTitle.fontFamily, fontSize: 13 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, fontSize: 16, color: colors.text, flex: 1 },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 17, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.base, paddingTop: 2 },
  link: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
});
