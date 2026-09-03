import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { api, ApiError } from './api';
import { Body, Button, Caption, Card, Heading } from './components/ui';
import { colors, spacing } from './theme';
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

/** Väntvyn med QR-kod och knapp för att öppna BankID på samma enhet. */
export function BankIdPanel({
  phase,
  qrData,
  hintText,
  autoStartUrl,
  onCancel,
  onRetry,
}: {
  phase: BankIdPhase;
  qrData: string | null;
  hintText: string;
  autoStartUrl: string | null;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (phase === 'failed') {
    return (
      <Card>
        <Heading>Det gick inte</Heading>
        <Body muted>{hintText || 'BankID svarade inte. Försök igen.'}</Body>
        <Button label="Försök igen" onPress={onRetry} />
      </Card>
    );
  }

  return (
    <Card>
      <Heading>Legitimera med BankID</Heading>
      <View style={styles.qrWrapper}>
        {qrData ? (
          <QRCode value={qrData} size={200} backgroundColor="#FFFFFF" color="#000000" />
        ) : (
          <View style={styles.qrPlaceholder} />
        )}
      </View>
      <Body muted>{hintText || 'Öppna BankID-appen och skanna koden.'}</Body>
      {autoStartUrl ? (
        <Button
          label="Öppna BankID på den här enheten"
          icon="phone-portrait-outline"
          onPress={() => void Linking.openURL(autoStartUrl)}
        />
      ) : null}
      <Button label="Avbryt" variant="ghost" onPress={onCancel} />
      <Caption>QR-koden byts automatiskt några gånger i sekunden.</Caption>
    </Card>
  );
}

const styles = StyleSheet.create({
  qrWrapper: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: 12,
  },
  qrPlaceholder: { width: 200, height: 200, backgroundColor: colors.surfaceRaised },
});
