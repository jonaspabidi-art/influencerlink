import { recogniseLink, supportsOembed } from '@pacta/shared';
import { describe, expect, it } from 'vitest';

describe('recogniseLink', () => {
  it('läser TikToks delningslänk och plockar ut konto och id', () => {
    const link = recogniseLink('https://www.tiktok.com/@annaater/video/7361234567890123456');
    expect(link).toMatchObject({
      platform: 'TIKTOK',
      postId: '7361234567890123456',
      handle: 'annaater',
    });
  });

  it('rensar bort spårningsparametrarna TikTok lägger på vid delning', () => {
    const link = recogniseLink(
      'https://www.tiktok.com/@annaater/video/7361234567890123456?is_from_webapp=1&sender_device=pc',
    );
    expect(link?.url).toBe('https://www.tiktok.com/@annaater/video/7361234567890123456');
  });

  it('godtar TikToks kortlänkar även utan id i adressen', () => {
    for (const url of ['https://vm.tiktok.com/ZMabcdef/', 'https://www.tiktok.com/t/ZTabcdef/']) {
      expect(recogniseLink(url)).toMatchObject({ platform: 'TIKTOK', postId: null });
    }
  });

  it('läser YouTubes tre former', () => {
    expect(recogniseLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      platform: 'YOUTUBE',
      postId: 'dQw4w9WgXcQ',
    });
    expect(recogniseLink('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ postId: 'dQw4w9WgXcQ' });
    expect(recogniseLink('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toMatchObject({
      postId: 'dQw4w9WgXcQ',
    });
  });

  it('läser Instagram-inlägg och reels', () => {
    expect(recogniseLink('https://www.instagram.com/reel/C1a2b3c4/')).toMatchObject({
      platform: 'INSTAGRAM',
      postId: 'C1a2b3c4',
    });
  });

  it('klarar adresser utan protokoll, som när man kopierar från en app', () => {
    expect(recogniseLink('tiktok.com/@annaater/video/123')).toMatchObject({ platform: 'TIKTOK' });
  });

  it('avvisar det som inte pekar på ett inlägg', () => {
    for (const bad of [
      '',
      'hej',
      'https://example.com/video/123',
      'https://www.tiktok.com/@annaater',
      'https://www.instagram.com/annaater',
      'https://www.youtube.com/@kockenerik',
    ]) {
      expect(recogniseLink(bad)).toBeNull();
    }
  });
});

describe('supportsOembed', () => {
  it('gäller TikTok och YouTube, som har öppna slutpunkter', () => {
    expect(supportsOembed('TIKTOK')).toBe(true);
    expect(supportsOembed('YOUTUBE')).toBe(true);
  });

  it('gäller inte Instagram, som kräver apptoken sedan 2020', () => {
    expect(supportsOembed('INSTAGRAM')).toBe(false);
  });
});
