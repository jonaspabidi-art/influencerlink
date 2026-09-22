import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { contractsQuery, matchesQuery, pendingReviewsQuery } from '../../src/queries';
import { formatDate, formatSek } from '../../src/format';
import { Avatar, Button, ErrorState, Header, Loading, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Contract, Match, PendingReview } from '../../src/types';

/**
 * Allt som pågår mellan företaget och en kreatör, på ett ställe.
 *
 * Matchningar och avtal låg i var sin flik. Det är två arkivfack för samma
 * sak: vägen från "vi är överens" till "filmen är godkänd" är ett förlopp,
 * och för en krögare som gör en kampanj i kvartalet stod båda facken tomma
 * nästan jämt.
 *
 * Sorteringen är därför inte efter vad något heter i databasen utan efter vad
 * som ska göras. Överst det som väntar på företaget, sedan det som väntar på
 * någon annan, sist det som är klart. Den som öppnar fliken ska kunna sluta
 * läsa efter första stycket.
 */

type Row =
  | { kind: 'match'; match: Match }
  | { kind: 'contract'; contract: Contract }
  | { kind: 'review'; review: PendingReview };

interface Section {
  title: string;
  lead?: string;
  data: Row[];
}

/** Vad företaget ska göra med avtalet, eller null när bollen ligger hos motparten. */
function businessTodo(contract: Contract): string | null {
  if (contract.awaitingMySignature) return 'Signera avtalet';
  if (contract.status === 'ACTIVE' && contract.paymentStatus !== 'ESCROWED' && contract.fee > 0) {
    return `Betala in ${formatSek(contract.fee)}`;
  }
  if (contract.status === 'DELIVERED') return 'Godkänn leveransen';
  return null;
}

/** Vad som händer nu, när inget väntar på företaget. */
function contractStatusText(contract: Contract): string {
  switch (contract.status) {
    case 'SENT':
    case 'PARTIALLY_SIGNED':
      return 'Väntar på kreatörens signatur';
    case 'ACTIVE':
      return `Pågår · deadline ${formatDate(contract.dueDate)}`;
    case 'COMPLETED':
      return 'Klart';
    case 'CANCELLED':
      return 'Avbrutet';
    default:
      return 'Utkast';
  }
}

export default function BusinessCollaborations() {
  const router = useRouter();
  const matches = useQuery(matchesQuery());
  const contracts = useQuery(contractsQuery());
  const reviews = useQuery(pendingReviewsQuery());

  if (matches.isLoading || contracts.isLoading) {
    return (
      <Screen>
        <Header title="Samarbeten" large />
        <Loading />
      </Screen>
    );
  }
  if (matches.isError || contracts.isError) {
    return (
      <Screen>
        <Header title="Samarbeten" large />
        <ErrorState
          message="Kunde inte hämta era samarbeten."
          onRetry={() => {
            void matches.refetch();
            void contracts.refetch();
          }}
        />
      </Screen>
    );
  }

  const allMatches = matches.data ?? [];
  const allContracts = contracts.data ?? [];
  const pending = reviews.data ?? [];

  // En matchning som redan blivit avtal ska inte stå två gånger.
  const openMatches = allMatches.filter((match) => match.contractId === null);

  const todo: Row[] = [
    ...allContracts.filter((contract) => businessTodo(contract) !== null).map(
      (contract) => ({ kind: 'contract' as const, contract }),
    ),
    ...pending.map((review) => ({ kind: 'review' as const, review })),
  ];

  const ongoing: Row[] = [
    ...openMatches.map((match) => ({ kind: 'match' as const, match })),
    ...allContracts
      .filter(
        (contract) =>
          businessTodo(contract) === null &&
          contract.status !== 'COMPLETED' &&
          contract.status !== 'CANCELLED',
      )
      .map((contract) => ({ kind: 'contract' as const, contract })),
  ];

  const done: Row[] = allContracts
    .filter((contract) => contract.status === 'COMPLETED' || contract.status === 'CANCELLED')
    .map((contract) => ({ kind: 'contract' as const, contract }));

  const sections: Section[] = [
    { title: 'Er tur', lead: 'Det här väntar på er.', data: todo },
    { title: 'Pågår', lead: 'Väntar på kreatören eller på leverans.', data: ongoing },
    { title: 'Klart', data: done },
  ].filter((section) => section.data.length > 0);

  if (sections.length === 0) {
    return (
      <Screen>
        <Header title="Samarbeten" large subtitle="Inget pågår ännu" />
        <View style={styles.emptyBody}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Här landar era samarbeten</Text>
            <Text style={styles.emptyText}>
              Ett samarbete börjar när ni och en kreatör båda sagt ja. Kreatörer söker själva till
              era uppdrag – de som gjort det står överst under Kreatörer. Ni kan också bjuda in
              någon direkt.
            </Text>
            <Button label="Se kreatörer" onPress={() => router.push('/business/discover')} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Samarbeten"
        large
        subtitle={todo.length > 0 ? `${todo.length} väntar på er` : `${ongoing.length} pågår`}
      />
      <SectionList
        sections={sections}
        keyExtractor={(row) =>
          row.kind === 'match' ? row.match.id : row.kind === 'review' ? row.review.contractId + ':r' : row.contract.id
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.lead ? <Text style={styles.secondary}>{section.lead}</Text> : null}
          </View>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'match') {
            const { match } = item;
            return (
              <Row
                onPress={() => router.push(`/match/${match.id}`)}
                avatarUri={match.influencer.avatarUrl}
                name={match.influencer.displayName}
                title={match.influencer.displayName}
                subtitle={match.campaign.title}
                status={match.lastMessage ?? 'Kom överens om upplägget'}
                statusColor={colors.muted}
                amount={formatSek(match.campaign.budgetPerCreator)}
              />
            );
          }
          if (item.kind === 'review') {
            const { review } = item;
            return (
              <Row
                onPress={() => router.push(`/contract/${review.contractId}/review`)}
                name={review.counterpartName}
                title={review.counterpartName}
                subtitle={review.campaignTitle}
                status={`Lämna omdöme · ${review.daysLeft} dagar kvar`}
                statusColor={colors.primary}
              />
            );
          }
          const { contract } = item;
          const todoText = businessTodo(contract);
          return (
            <Row
              onPress={() => router.push(`/contract/${contract.id}`)}
              avatarUri={contract.influencerAvatarUrl}
              name={contract.influencerName}
              title={contract.influencerName}
              subtitle={contract.campaignTitle}
              status={todoText ?? contractStatusText(contract)}
              statusColor={todoText ? colors.primary : colors.muted}
              amount={contract.fee > 0 ? formatSek(contract.fee) : 'Mot mat'}
            />
          );
        }}
      />
    </Screen>
  );
}

function Row({
  onPress,
  avatarUri,
  name,
  title,
  subtitle,
  status,
  statusColor,
  amount,
}: {
  onPress: () => void;
  avatarUri?: string | null;
  name: string;
  title: string;
  subtitle: string;
  status: string;
  statusColor: string;
  amount?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar uri={avatarUri ?? null} name={name} size={44} />
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={[styles.status, { color: statusColor }]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      {amount ? <Text style={styles.amount}>{amount}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  sectionHead: { gap: 2, paddingTop: spacing.md, paddingBottom: 2 },
  sectionTitle: { ...type.rowTitle, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: 2 },
  title: { ...type.listTitle, fontSize: 16, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  status: { fontFamily: type.listTitle.fontFamily, fontSize: 13 },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.accent },

  emptyBody: { flex: 1, paddingHorizontal: spacing.base, gap: 14 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 22,
    gap: 14,
  },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
});
