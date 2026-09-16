import { toPaginated, cleanParams } from './index';
import type { ApiResponse } from './index';

describe('toPaginated', () => {
  it('extracts items and meta from a full ApiResponse', () => {
    const response: ApiResponse<string[]> = {
      success: true,
      data: ['a', 'b', 'c'],
      meta: { total: 3, page: 1, limit: 10 },
    };
    expect(toPaginated(response)).toEqual({
      items: ['a', 'b', 'c'],
      meta: { total: 3, page: 1, limit: 10 },
    });
  });

  it('uses default meta when meta is absent', () => {
    const response: ApiResponse<string[]> = { success: true, data: [] };
    expect(toPaginated(response).meta).toEqual({ total: 0, page: 1, limit: 10 });
  });

  it('returns empty items array when data is null-ish', () => {
    const response = { success: true, data: null as unknown as string[] };
    expect(toPaginated(response).items).toEqual([]);
  });

  it('preserves object items without mutation', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const response: ApiResponse<typeof items> = { success: true, data: items };
    expect(toPaginated(response).items).toBe(items);
  });
});

describe('cleanParams', () => {
  it('removes undefined values', () => {
    expect(cleanParams({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('removes null values', () => {
    expect(cleanParams({ a: 'x', b: null })).toEqual({ a: 'x' });
  });

  it('removes empty string values', () => {
    expect(cleanParams({ a: 'x', b: '' })).toEqual({ a: 'x' });
  });

  it('keeps numeric zero', () => {
    expect(cleanParams({ page: 0 })).toEqual({ page: 0 });
  });

  it('keeps boolean false', () => {
    expect(cleanParams({ active: false })).toEqual({ active: false });
  });

  it('keeps all present values', () => {
    const params = { page: 1, limit: 10, search: 'foo' };
    expect(cleanParams(params)).toEqual(params);
  });

  it('returns empty object when every value is empty', () => {
    expect(cleanParams({ a: null, b: undefined, c: '' })).toEqual({});
  });
});
