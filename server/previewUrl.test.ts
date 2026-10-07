import test from 'node:test';
import assert from 'node:assert/strict';

import { getLeadPreviewUrl, getPreviewBaseUrl, sanitizeDemoUrl } from './previewUrl.js';

test('builds a preview URL from the configured base domain', () => {
  const url = getLeadPreviewUrl({ id: 'lead-123' }, { baseDomain: 'adeolamedia.co.uk' }, {
    PUBLIC_PREVIEW_BASE_URL: '',
    RENDER_EXTERNAL_URL: 'https://service.onrender.com',
  });

  assert.equal(url, 'https://adeolamedia.co.uk/demo/lead-123');
});

test('prefers the explicit public preview base URL when provided', () => {
  const url = getLeadPreviewUrl({ id: 'lead-456' }, { baseDomain: 'old.example.com' }, {
    PUBLIC_PREVIEW_BASE_URL: 'https://preview.example.com',
    RENDER_EXTERNAL_URL: '',
  });

  assert.equal(url, 'https://preview.example.com/demo/lead-456');
});

test('falls back to cloud platform URL when baseDomain is not configured', () => {
  const url = getLeadPreviewUrl({ id: 'lead-cloud' }, { baseDomain: '' }, {
    RENDER_EXTERNAL_URL: 'https://coldreach.onrender.com'
  });
  assert.equal(url, 'https://coldreach.onrender.com/demo/lead-cloud');
});

test('falls back to localhost for local development', () => {
  const url = getLeadPreviewUrl({ id: 'lead-789' }, {}, {});
  assert.equal(url, 'http://localhost:5001/demo/lead-789');
});

test('normalizes a plain host without protocol', () => {
  assert.equal(getPreviewBaseUrl({ baseDomain: 'adeolamedia.co.uk' }, {}), 'https://adeolamedia.co.uk');
});

test('sanitizes broken subdomain URLs into working direct demo URLs', () => {
  const brokenSubdomainUrl = 'https://apex-dental.adeolamedia.co.uk';
  const sanitized = sanitizeDemoUrl(brokenSubdomainUrl, { id: 'apex-dental-id', subdomain: 'apex-dental' }, { baseDomain: 'adeolamedia.co.uk' }, {});
  assert.equal(sanitized, 'https://adeolamedia.co.uk/demo/apex-dental-id');
});

test('preserves already working demo path URLs', () => {
  const existingDemoUrl = 'https://adeolamedia.co.uk/demo/lead-abc';
  const sanitized = sanitizeDemoUrl(existingDemoUrl, { id: 'lead-abc' }, { baseDomain: 'adeolamedia.co.uk' }, {});
  assert.equal(sanitized, 'https://adeolamedia.co.uk/demo/lead-abc');
});
