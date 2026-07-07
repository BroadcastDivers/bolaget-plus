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

  test('fetchRatingFromUntappd returns data for a cider query', async () => {
    const result = await fetchRatingFromUntappd('Rekorderlig Päron');

    expect(result).not.toBeNull();
    expect(result?.status).toBe(RatingResultStatus.Found);
    expect(result?.rating).toBeGreaterThan(0);
    expect(result?.votes).toBeGreaterThan(0);
    expect(result?.link).toContain('untappd.com');
  });
});

// Offline tests: the Vivino explore API only indexes marketplace wines, so a
// miss must surface an Uncertain result with a working search link — never a
// dead-end NotFound.
test.describe('Vivino lookup misses (mocked fetch)', () => {
  const realFetch = globalThis.fetch;

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('returns Uncertain with a search link when the explore API has no matches', async () => {
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ explore_vintage: { matches: [] } })
      } as Response)) as typeof fetch;

    const result = await fetchRatingFromVivino('Torre do Olivar');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.link).toBe(
      'https://www.vivino.com/search/wines?q=Torre%20do%20Olivar'
    );
  });

  test('returns Uncertain with a search link when the request fails', async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error('network down'))) as typeof fetch;

    const result = await fetchRatingFromVivino('Some Obscure Wine');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.link).toContain('vivino.com/search/wines');
  });
});