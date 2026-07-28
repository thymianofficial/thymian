import { describe, expect, it } from 'vitest';

import { resolveResourceEmbed } from '../src/components/resources/resourceMeta';
import { type ResourceType } from '../src/schema/resources';

const call = (over: {
  resourceType?: ResourceType;
  url?: string;
  embeddable?: boolean;
  title?: string;
}) =>
  resolveResourceEmbed({
    resourceType: over.resourceType ?? 'recorded talk',
    url: over.url ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    embeddable: over.embeddable ?? true,
    title: over.title ?? 'My Talk',
  });

describe('resolveResourceEmbed — embed branch', () => {
  it('embeds an embeddable YouTube watch URL as a youtube-nocookie player', () => {
    expect(
      call({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    ).toEqual({
      kind: 'embed',
      provider: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      title: 'My Talk — embedded player',
      fallback: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        label: 'Watch on YouTube',
      },
    });
  });

  it('embeds a youtu.be short URL', () => {
    const r = call({ url: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(r.kind).toBe('embed');
    if (r.kind === 'embed') {
      expect(r.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  it('embeds a /embed/, /shorts/ and /live/ path form', () => {
    for (const url of [
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) {
      const r = call({ url });
      expect(r.kind).toBe('embed');
      if (r.kind === 'embed') {
        expect(r.src).toBe(
          'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        );
      }
    }
  });
});

describe('resolveResourceEmbed — link branch', () => {
  it('links out a paper even when embeddable is true, with a paper label', () => {
    expect(
      call({
        resourceType: 'paper',
        embeddable: true,
        url: 'https://arxiv.org/abs/1234.5678',
      }),
    ).toEqual({
      kind: 'link',
      url: 'https://arxiv.org/abs/1234.5678',
      label: 'Read the paper',
    });
  });

  it('links out an author-declared non-embeddable resource with a host label', () => {
    expect(
      call({
        embeddable: false,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    ).toEqual({
      kind: 'link',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      label: 'Watch on YouTube',
    });
  });

  it('links out (safe default) an embeddable but unrecognised host', () => {
    const r = call({ url: 'https://example.com/talk' });
    expect(r).toEqual({
      kind: 'link',
      url: 'https://example.com/talk',
      label: 'Watch the recording',
    });
  });

  it('rejects a look-alike host and links out (isHost boundary)', () => {
    const r = call({ url: 'https://evilyoutube.com/watch?v=dQw4w9WgXcQ' });
    expect(r.kind).toBe('link');
  });

  it('links out a malformed URL without throwing', () => {
    const r = call({ url: 'not a url' });
    expect(r).toEqual({
      kind: 'link',
      url: 'not a url',
      label: 'Watch the recording',
    });
  });

  it('links out a YouTube URL whose id is not a valid 11-char id', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=',
      'https://www.youtube.com/watch?v=short',
      'https://youtu.be/',
    ]) {
      expect(call({ url }).kind).toBe('link');
    }
  });
});

describe('resolveResourceEmbed — type-appropriate link labels', () => {
  it('keeps a recognised platform label for a podcast on a known host', () => {
    const r = call({
      resourceType: 'podcast episode',
      embeddable: false,
      url: 'https://open.spotify.com/episode/xyz',
    });
    expect(r).toEqual({
      kind: 'link',
      url: 'https://open.spotify.com/episode/xyz',
      label: 'Listen on Spotify',
    });
  });

  it('labels an unrecognised-host podcast "Listen to the episode" (not "Watch…")', () => {
    const r = call({
      resourceType: 'podcast episode',
      embeddable: false,
      url: 'https://example.com/episodes/42',
    });
    expect(r).toEqual({
      kind: 'link',
      url: 'https://example.com/episodes/42',
      label: 'Listen to the episode',
    });
  });

  it('keeps "Watch the recording" for an unrecognised-host webinar/talk', () => {
    expect(
      call({
        resourceType: 'webinar',
        embeddable: false,
        url: 'https://example.com/webinar',
      }),
    ).toEqual({
      kind: 'link',
      url: 'https://example.com/webinar',
      label: 'Watch the recording',
    });
  });
});
