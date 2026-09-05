import { describe, expect, it } from 'vitest';
import { MOCK_CANCEL_PERSONAL_NUMBER, MockBankIdClient } from '../services/bankid/index.js';
import { buildAutoStartUrl, buildQrData } from '../services/bankid/qr.js';
import { translateBankIdError, translateBankIdHint } from '../services/bankid/live.js';

describe('MockBankIdClient', () => {
  it('går från pending till complete precis som den riktiga tjänsten', async () => {
    const client = new MockBankIdClient();
    const order = await client.auth({ endUserIp: '127.0.0.1', personalNumber: '199001011234' });

    expect(await client.collect(order.orderRef)).toMatchObject({ status: 'pending' });

    const done = await client.collect(order.orderRef);
    expect(done.status).toBe('complete');
    expect(done.completionData?.personalNumber).toBe('199001011234');
    expect(done.completionData?.signature).toBeTruthy();
  });

  it('ger samma personnummer samma namn varje gång', async () => {
    const client = new MockBankIdClient();
    const first = await client.auth({ endUserIp: '127.0.0.1', personalNumber: '198505054321' });
    await client.collect(first.orderRef);
    const firstResult = await client.collect(first.orderRef);

    const second = await client.auth({ endUserIp: '127.0.0.1', personalNumber: '198505054321' });
    await client.collect(second.orderRef);
    const secondResult = await client.collect(second.orderRef);

    expect(firstResult.completionData?.name).toBe(secondResult.completionData?.name);
  });

  it('svarar userCancel för testpersonnumret som ska misslyckas', async () => {
    const client = new MockBankIdClient();
    const order = await client.auth({
      endUserIp: '127.0.0.1',
      personalNumber: MOCK_CANCEL_PERSONAL_NUMBER,
    });
    expect(await client.collect(order.orderRef)).toMatchObject({
      status: 'failed',
      hintCode: 'userCancel',
    });
  });

  it('svarar failed när användaren avbryter', async () => {
    const client = new MockBankIdClient();
    const order = await client.auth({ endUserIp: '127.0.0.1' });
    await client.cancel(order.orderRef);
    expect(await client.collect(order.orderRef)).toMatchObject({ status: 'failed' });
  });

  it('behandlar okända orderRef som utgångna', async () => {
    const client = new MockBankIdClient();
    expect(await client.collect('finns-inte')).toMatchObject({
      status: 'failed',
      hintCode: 'expiredTransaction',
    });
  });

  it('signering returnerar en order med samma form som auth', async () => {
    const client = new MockBankIdClient();
    const order = await client.sign({
      endUserIp: '127.0.0.1',
      userVisibleData: 'Signera avtal',
      personalNumber: '199001011234',
    });
    expect(order).toMatchObject({
      orderRef: expect.any(String),
      autoStartToken: expect.any(String),
      qrStartToken: expect.any(String),
      qrStartSecret: expect.any(String),
    });
  });
});

describe('buildQrData', () => {
  const startedAt = new Date('2026-01-01T12:00:00Z');

  it('följer BankID:s format bankid.<token>.<sekunder>.<hmac>', () => {
    const qr = buildQrData('token', 'hemlighet', startedAt, startedAt);
    const parts = qr.split('.');
    expect(parts[0]).toBe('bankid');
    expect(parts[1]).toBe('token');
    expect(parts[2]).toBe('0');
    expect(parts[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ger en ny kod för varje sekund som går', () => {
    const first = buildQrData('token', 'hemlighet', startedAt, startedAt);
    const later = buildQrData('token', 'hemlighet', startedAt, new Date(startedAt.getTime() + 3000));
    expect(first).not.toBe(later);
    expect(later.split('.')[2]).toBe('3');
  });

  it('är deterministisk för samma tidpunkt', () => {
    const now = new Date(startedAt.getTime() + 5000);
    expect(buildQrData('t', 's', startedAt, now)).toBe(buildQrData('t', 's', startedAt, now));
  });

  it('klarar en klocka som gått bakåt utan att ge negativ tid', () => {
    const before = new Date(startedAt.getTime() - 5000);
    expect(buildQrData('t', 's', startedAt, before).split('.')[2]).toBe('0');
  });
});

describe('buildAutoStartUrl', () => {
  it('kodar retur-URL:en så att djuplänken överlever', () => {
    const url = buildAutoStartUrl('abc', 'pacta://bankid/return');
    expect(url).toContain('autostarttoken=abc');
    expect(url).toContain('redirect=pacta%3A%2F%2Fbankid%2Freturn');
  });
});

describe('översättningar', () => {
  it('ger svensk text för de hintkoder användaren faktiskt möter', () => {
    expect(translateBankIdHint('userSign')).toMatch(/säkerhetskod/);
    expect(translateBankIdHint('userCancel')).toMatch(/avbröt/);
    expect(translateBankIdHint(undefined)).toMatch(/Väntar/);
  });

  it('ger en begriplig text även för okända felkoder', () => {
    expect(translateBankIdError('nagot-nytt')).toMatch(/BankID/);
    expect(translateBankIdError('alreadyInProgress')).toMatch(/pågående/);
  });
});
