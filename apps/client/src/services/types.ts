// Single source of truth lives in @repo/shared-types.
// All existing imports in this app continue to work unchanged.
export type {
  ApiResponse,
  PaginationMeta,
  Paginated,
  ListQuery,
  DateRangeQuery,
} from '@repo/shared-types';

export { toPaginated, cleanParams } from '@repo/shared-types';
