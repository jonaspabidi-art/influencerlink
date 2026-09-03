import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError } from './api';
import { Button, Header, Screen } from './components/ui';
import { colors, radius, spacing, type } from './theme';
import type { BankIdStart, BankIdStatus } from './types';

/** BankID:s QR-kod byts varje sekund; vi hämtar status lika ofta som den roterar. */
const POLL_INTERVAL_MS = 1200;

export type BankIdPhase = 'idle' | 'starting' | 'pending' | 'complete' | 'failed';

export interface UseBankIdOptions {
  purpose: 'LOGIN' | 'SIGN';
  onComplete: (status: BankIdStatus) => void;
}

export interface StartOptions {
  role?: 'INFLUENCER' | 'BUSINESS';
  personalNumber?: string;
  contractId?: string;
}

/**
 * Driver en BankID-order: startar den, pollar status och avbryter snyggt om
 * skärmen lämnas. Samma hook används både för inloggning och avtalssignering.
 */
export function useBankId({ purpose, onComplete }: UseBankIdOptions) {
  const [phase, setPhase] = useState<BankIdPhase>('idle');
  const [qrData, setQrData] = useState<string | null>(null);
  const [hintText, setHintText] = useState('');
  const [autoStartUrl, setAutoStartUrl] = useState<string | null>(null);
  const orderRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const cancel = useCallback(async () => {
    stopPolling();
    const ref = orderRef.current;
    orderRef.current = null;
    setPhase('idle');
    setQrData(null);
    setAutoStartUrl(null);
    if (ref) await api.post(`/auth/bankid/${ref}/cancel`).catch(() => undefined);
  }, [stopPolling]);

  const poll = useCallback(async () => {
    const ref = orderRef.current;
    if (!ref) return;
    try {
      const status = await api.get<BankIdStatus>(`/auth/bankid/${ref}`);
      if (!mounted.current) return;

      setHintText(status.hintText);
      if (status.qrData) setQrData(status.qrData);

      if (status.status === 'COMPLETE') {
        stopPolling();
        orderRef.current = null;
        setPhase('complete');
        onComplete(status);
        return;
      }
      if (status.status === 'FAILED') {
        stopPolling();
        orderRef.current = null;
        setPhase('failed');
        return;
      }
      timer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    } catch (error) {
      if (!mounted.current) return;
      stopPolling();
      orderRef.current = null;
      setPhase('failed');
      setHintText(
        error instanceof ApiError ? error.message : 'Kunde inte nå servern. Kontrollera nätet.',
      );
    }
  }, [onComplete, stopPolling]);

  const start = useCallback(
    async (options: StartOptions = {}) => {
      setPhase('starting');
      setHintText('Startar BankID …');
      try {
        const order = await api.post<BankIdStart>('/auth/bankid/start', {
          purpose,
          ...options,
        });
        if (!mounted.current) return;
        orderRef.current = order.orderRef;
        setQrData(order.qrData);
        setAutoStartUrl(order.autoStartUrl);
        setPhase('pending');
        timer.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (error) {
        if (!mounted.current) return;
        setPhase('failed');
        setHintText(
          error instanceof ApiError ? error.message : 'Kunde inte starta BankID. Försök igen.',
        );
      }
    },
    [poll, purpose],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return { phase, qrData, hintText, autoStartUrl, start, cancel };
}

/**
 * Hela BankID-skärmen: QR-kod, statustext som byts under tiden, och de två
 * knapparna längst ned. Används både vid inloggning och avtalssignering.
 */
export function BankIdScreen({
  phase,
  qrData,
  hintText,
  autoStartUrl,
  onCancel,
  onRetry,
  title = 'Legitimera dig',
}: {
  phase: BankIdPhase;
  qrData: string | null;
  hintText: string;
  autoStartUrl: string | null;
  onCancel: () => void;
  onRetry: () => void;
  title?: string;
}) {
  const failed = phase === 'failed';

  return (
    <Screen>
      <Header title={title} onBack={onCancel} />

      <View style={styles.body}>
        <View style={styles.qrFrame}>
          {qrData && !failed ? (
            <QRCode value={qrData} size={164} backgroundColor="transparent" color={colors.text} />
          ) : (
            <View style={styles.qrPlaceholder} />
          )}
        </View>

        <View style={styles.copy}>
          <Text style={styles.heading}>
            {failed ? 'Det gick inte' : 'Skriv in din säkerhetskod'}
          </Text>
          <Text style={styles.explanation}>
            {failed
              ? hintText || 'BankID svarade inte. Försök igen.'
              : 'Öppna BankID-appen och skanna koden. Vi hämtar bara namn och personnummer.'}
          </Text>
        </View>

        {!failed ? (
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{hintText || 'Väntar på BankID …'}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        <View style={styles.actions}>
          {failed ? (
            <Button label="Försök igen" onPress={onRetry} />
          ) : autoStartUrl ? (
            <Button
              label="Öppna BankID på denna enhet"
              onPress={() => void Linking.openURL(autoStartUrl)}
            />
          ) : null}
          <Button label="Avbryt" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: 28,
  },
  qrFrame: {
    width: 220,
    height: 220,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  qrPlaceholder: { width: 164, height: 164, backgroundColor: colors.raised },
  copy: { alignItems: 'center', gap: spacing.sm },
  heading: { fontFamily: type.amount.fontFamily, fontSize: 22, color: colors.text },
  explanation: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    backgroundColor: colors.raised,
  },
  statusDot: { width: 8, height: 8, borderRadius: radius.round, backgroundColor: colors.accent },
  statusText: { ...type.secondary, color: colors.muted },
  spacer: { flex: 1 },
  actions: { width: '100%', gap: spacing.md, paddingBottom: spacing.xl },
});
