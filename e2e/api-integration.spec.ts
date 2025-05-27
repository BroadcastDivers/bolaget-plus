import { test, expect } from '@playwright/test';
import  * as vivino from '../src/services/integrations/vivino';
import * as untappd from '../src/services/integrations/untappd';
import { RatingResultStatus } from '../src/@types/types';

test.describe('API Integration Tests', () => {
  test('vivino.getRating returns data for valid query', async () => {
    const result = await vivino.getRating('Bread & Butter');
    
    expect(result).not.toBeNull();
    expect(result?.status).toBe(RatingResultStatus.Found);
    expect(result?.rating).toBeGreaterThan(0);
    expect(result?.votes).toBeGreaterThan(0);
    expect(result?.link).toContain('vivino.com');
  });

  test('untappd.getRating returns data for valid query', async () => {
    const result = await untappd.getRating('Pabst Blue Ribbon');
    
    expect(result).not.toBeNull();
    expect(result?.status).toBe(RatingResultStatus.Found);
    expect(result?.rating).toBeGreaterThan(0);
    expect(result?.votes).toBeGreaterThan(0);
    expect(result?.link).toContain('untappd.com');
  });
});