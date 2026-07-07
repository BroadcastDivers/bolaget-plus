import { test, expect } from '@playwright/test';
import { fetchRatingFromVivino, fetchRatingFromUntappd } from '../src/components/api';
import { RatingResultStatus } from '../src/@types/types';

test.describe('API Integration Tests', () => {
  test('fetchRatingFromVivino returns data for valid query', async () => {
    const result = await fetchRatingFromVivino('Bread & Butter');
    
    expect(result).not.toBeNull();
    expect(result?.status).toBe(RatingResultStatus.Found);
    expect(result?.rating).toBeGreaterThan(0);
    expect(result?.votes).toBeGreaterThan(0);
    expect(result?.link).toContain('vivino.com');
  });

  test('fetchRatingFromUntappd returns data for valid query', async () => {
    const result = await fetchRatingFromUntappd('Pabst Blue Ribbon');

    expect(result).not.toBeNull();
    expect(result?.status).toBe(RatingResultStatus.Found);
    expect(result?.rating).toBeGreaterThan(0);
    expect(result?.votes).toBeGreaterThan(0);
    expect(result?.link).toContain('untappd.com');
  });
});

// Offline tests for the Vivino search-page fallback. The explore API only
// indexes marketplace wines, so catalogue-only wines (e.g. Torre do Olivar)
// come back empty there and must be recovered by scraping the web search.
test.describe('Vivino search-page fallback (mocked fetch)', () => {
  const realFetch = globalThis.fetch;

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mockFetch(handler: (url: string) => { body: string; ok?: boolean }) {
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const { body, ok = true } = handler(url);
      return Promise.resolve({
        ok,
        json: () => Promise.resolve(JSON.parse(body)),
        text: () => Promise.resolve(body),
      } as Response);
    }) as typeof fetch;
  }

  test('recovers a catalogue-only wine from the search page when the explore API is empty', async () => {
    mockFetch((url) => {
      if (url.includes('/api/explore/explore')) {
        return { body: JSON.stringify({ explore_vintage: { matches: [] } }) };
      }
      return {
        body: `
          <div class="default-wine-card">
            <a href="/w/172616684">link</a>
            <span class="wine-card__name">Torre do Olivar</span>
            <div class="average__number">4,2</div>
            <div class="average__stars"><span class="text-micro">1 234 ratings</span></div>
          </div>`,
      };
    });

    const result = await fetchRatingFromVivino('Torre do Olivar');

    expect(result.status).toBe(RatingResultStatus.Found);
    expect(result.rating).toBeCloseTo(4.2);
    expect(result.votes).toBe(1234);
    expect(result.link).toBe('https://www.vivino.com/w/172616684');
  });

  test('returns Uncertain with a search link (not NotFound) when nothing is found anywhere', async () => {
    mockFetch((url) => {
      if (url.includes('/api/explore/explore')) {
        return { body: JSON.stringify({ explore_vintage: { matches: [] } }) };
      }
      return { body: '<div class="no-results"></div>' };
    });

    const result = await fetchRatingFromVivino('Some Obscure Wine');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.link).toContain('vivino.com/search/wines');
    expect(result.link).toContain('Some%20Obscure%20Wine');
  });
});