import { MAX_IMAGE_BYTES, mediaPath, mediaUrlSchema, uploadInputSchema } from '@pacta/shared';
import { describe, expect, it } from 'vitest';

/** En riktig, minimal PNG – en genomskinlig pixel. */
const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('mediaPath', () => {
  it('ger en relativ adress, så att den överlever ett domänbyte', () => {
    expect(mediaPath('abc123')).toBe('/media/abc123');
  });
});

describe('mediaUrlSchema', () => {
  it('tar emot våra egna bilder', () => {
    expect(mediaUrlSchema.safeParse('/media/abc123').success).toBe(true);
  });

  it('tar emot https-adresser, t.ex. miniatyrer från TikTok', () => {
    expect(mediaUrlSchema.safeParse('https://p16.tiktokcdn.com/bild.jpeg').success).toBe(true);
  });

  // En bild över osäker anslutning blockeras ändå av appen, och en
  // javascript-adress ska aldrig hamna i ett src-attribut.
  it.each(['http://example.com/bild.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAA', '../../etc/passwd'])(
    'avvisar %s',
    (value) => {
      expect(mediaUrlSchema.safeParse(value).success).toBe(false);
    },
  );

  it('avvisar orimligt långa adresser', () => {
    expect(mediaUrlSchema.safeParse(`https://x.se/${'a'.repeat(500)}`).success).toBe(false);
  });
});

describe('uploadInputSchema', () => {
  it('tar emot en png med mått', () => {
    const parsed = uploadInputSchema.safeParse({
      mimeType: 'image/png',
      data: PNG_1PX,
      width: 1,
      height: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it('tar emot en bild utan kända mått', () => {
    expect(uploadInputSchema.safeParse({ mimeType: 'image/jpeg', data: PNG_1PX }).success).toBe(true);
  });

  // SVG kan innehålla skript och renderas i en webbläsare.
  it.each(['image/svg+xml', 'text/html', 'application/pdf'])('avvisar %s', (mimeType) => {
    expect(uploadInputSchema.safeParse({ mimeType, data: PNG_1PX }).success).toBe(false);
  });

  it('avvisar tomt innehåll', () => {
    expect(uploadInputSchema.safeParse({ mimeType: 'image/png', data: '' }).success).toBe(false);
  });
});

describe('MAX_IMAGE_BYTES', () => {
  // Gränsen ska ligga under serverns bodyLimit på 5 MB, med marginal för att
  // base64 lägger på en tredjedel.
  it('lämnar plats för base64-påslaget under bodyLimit', () => {
    expect(Math.ceil((MAX_IMAGE_BYTES * 4) / 3)).toBeLessThan(5_000_000);
  });
});
