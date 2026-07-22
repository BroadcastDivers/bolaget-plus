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

  // Regression test: vivino.com/wines/{id} resolves by vintage id, not the
  // generic wine id — using wine.id links to an unrelated wine (e.g. the
  // Black Stallion Cabernet Sauvignon 2023's wine.id 1166077 resolves to a
  // 2005 Bourgogne Pinot Noir instead).
  test('builds the wine link from the vintage id, not the generic wine id', async () => {
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            explore_vintage: {
              matches: [
                {
                  vintage: {
                    id: 173862896,
                    name: 'Black Stallion Cabernet Sauvignon 2023',
                    statistics: { ratings_average: 4.1, ratings_count: 54 },
                    wine: {
                      id: 1166077,
                      seo_name: 'black-stallion-cabernet-sauvignon'
                    }
                  }
                }
              ]
            }
          })
      } as Response)) as typeof fetch;

    const result = await fetchRatingFromVivino(
      'Black Stallion Napa Valley Cabernet Sauvignon 2023'
    );

    expect(result.link).toBe('https://www.vivino.com/wines/173862896');
  });

  test('returns ranked alternatives when no Vivino match is confident enough', async () => {
    const vivinoMatch = (id: number, name: string, rating: number, votes: number) => ({
      vintage: {
        id,
        name,
        statistics: { ratings_average: rating, ratings_count: votes },
        wine: { id: id + 1, seo_name: 'irrelevant' }
      }
    });

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            explore_vintage: {
              matches: [
                // Similarities to the query (all below the 0.5 threshold):
                // 0.200, 0.457, 0.167, 0.057 — so no auto-accept, and the
                // ranked alternatives start with Falco Nero Riserva.
                vivinoMatch(1, 'Torre Bianca Chardonnay', 4.0, 100),
                vivinoMatch(2, 'Falco Nero Riserva', 4.4, 300),
                vivinoMatch(3, 'Nero d Avola Sicilia', 3.8, 50),
                vivinoMatch(4, 'Rioja Gran Reserva', 3.9, 80)
              ]
            }
          })
      } as Response)) as typeof fetch;

    const result = await fetchRatingFromVivino('Torre del Falco Nero 2020');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.link).toContain('vivino.com/search/wines');
    // Capped at 3, ranked by similarity to the query.
    expect(result.alternatives).toHaveLength(3);
    expect(result.alternatives?.[0]).toEqual({
      link: 'https://www.vivino.com/wines/2',
      name: 'Falco Nero Riserva',
      rating: 4.4,
      votes: 300
    });
  });

  test('attaches label thumbnails as data URLs (page CSP blocks hotlinking)', async () => {
    const exploreJson = {
      explore_vintage: {
        matches: [
          {
            vintage: {
              id: 42,
              image: {
                variations: {
                  label_medium: '//images.vivino.com/thumbs/fake_150x200.png'
                }
              },
              name: 'Black Stallion Cabernet Sauvignon 2023',
              statistics: { ratings_average: 4.1, ratings_count: 54 },
              wine: { id: 43, seo_name: 'irrelevant' }
            }
          }
        ]
      }
    };
    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/explore/explore')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(exploreJson)
        } as Response);
      }
      // Image request — must be the https-normalized thumbnail URL.
      expect(url).toBe('https://images.vivino.com/thumbs/fake_150x200.png');
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(fakePng.buffer),
        headers: new Headers({ 'content-type': 'image/png' }),
        ok: true
      } as unknown as Response);
    }) as typeof fetch;

    const result = await fetchRatingFromVivino(
      'Black Stallion Napa Valley Cabernet Sauvignon 2023'
    );

    expect(result.status).toBe(RatingResultStatus.Found);
    expect(result.imageDataUrl).toBe(
      `data:image/png;base64,${Buffer.from(fakePng).toString('base64')}`
    );
  });

  test('attaches thumbnails to alternatives when the match is uncertain', async () => {
    const fakePng = new Uint8Array([1, 2, 3]);
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/explore/explore')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              explore_vintage: {
                matches: [
                  {
                    vintage: {
                      id: 7,
                      image: {
                        variations: {
                          label_medium: '//images.vivino.com/thumbs/alt.png'
                        }
                      },
                      name: 'Totally Unrelated Wine',
                      statistics: { ratings_average: 4.0, ratings_count: 10 },
                      wine: { id: 8, seo_name: 'x' }
                    }
                  }
                ]
              }
            })
        } as Response);
      }
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(fakePng.buffer),
        headers: new Headers({ 'content-type': 'image/png' }),
        ok: true
      } as unknown as Response);
    }) as typeof fetch;

    const result = await fetchRatingFromVivino('Zzz Qqq 1999');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives?.[0].imageDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  test('skips thumbnail downloads when includeImage is false (list pages)', async () => {
    const imageRequests: string[] = [];
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/explore/explore')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              explore_vintage: {
                matches: [
                  {
                    vintage: {
                      id: 42,
                      image: {
                        variations: {
                          label_medium: '//images.vivino.com/thumbs/x.png'
                        }
                      },
                      name: 'Black Stallion Cabernet Sauvignon 2023',
                      statistics: { ratings_average: 4.1, ratings_count: 54 },
                      wine: { id: 43, seo_name: 'irrelevant' }
                    }
                  }
                ]
              }
            })
        } as Response);
      }
      imageRequests.push(url);
      return Promise.reject(new Error('unexpected image fetch'));
    }) as typeof fetch;

    const result = await fetchRatingFromVivino(
      'Black Stallion Napa Valley Cabernet Sauvignon 2023',
      false
    );

    expect(result.status).toBe(RatingResultStatus.Found);
    expect(result.imageDataUrl).toBeUndefined();
    expect(imageRequests).toHaveLength(0);
    // Internal scoring fields must not leak into the response/cache.
    expect(result).not.toHaveProperty('similarityRate');
    expect(result).not.toHaveProperty('imageUrl');
  });

  test('returns no alternatives when the explore API has no matches', async () => {
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ explore_vintage: { matches: [] } })
      } as Response)) as typeof fetch;

    const result = await fetchRatingFromVivino('Torre do Olivar');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.alternatives).toBeUndefined();
  });
});

test.describe('Untappd lookup misses (mocked fetch)', () => {
  const realFetch = globalThis.fetch;

  test.afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('returns ranked alternatives when no Untappd match is confident enough', async () => {
    const untappdHit = (bid: number, name: string, rating: number, votes: number) => ({
      beer_name: name,
      beer_slug: `slug-${bid}`,
      bid,
      brewery_beer_name: `Brygghus ${name}`,
      brewery_name: 'Brygghus',
      rating_count: votes,
      rating_score: rating
    });

    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [
              // Similarities to the query (all below the 0.2 threshold):
              // 0.171, 0.194, 0.176, 0.118 — so no auto-accept, and the
              // ranked alternatives start with Sommarlager.
              untappdHit(1, 'Lagerhaus Dunkel', 3.2, 40),
              untappdHit(2, 'Sommarlager', 3.9, 200),
              untappdHit(3, 'Pilsner Urquell', 3.5, 90),
              untappdHit(4, 'Citra Hazy Juice', 3.1, 10)
            ]
          })
      } as Response)) as typeof fetch;

    const result = await fetchRatingFromUntappd('Mystery Brew IPA');

    expect(result.status).toBe(RatingResultStatus.Uncertain);
    expect(result.link).toContain('untappd.com/search');
    expect(result.alternatives).toHaveLength(3);
    expect(result.alternatives?.[0].name).toBe('Sommarlager');
    expect(result.alternatives?.[0].link).toBe(
      'https://untappd.com/b/slug-2/2'
    );
  });
});