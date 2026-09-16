// API envelope — every endpoint response wraps its data in this shape.
export type ApiResponse<T> = {
  success: boolean;
  statusCode?: number;
  message?: string;
  data: T;
  meta?: PaginationMeta;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
};

// Shape every list endpoint resolves to after transformResponse.
export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

export type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
};

export type DateRangeQuery = {
  date?: string;
  startDate?: string;
  endDate?: string;
};

const DEFAULT_META: PaginationMeta = { total: 0, page: 1, limit: 10 };

// Folds the server's { data, meta } envelope into a Paginated<T>.
export const toPaginated = <T>(response: ApiResponse<T[]>): Paginated<T> => ({
  items: response.data ?? [],
  meta: response.meta ?? DEFAULT_META,
});

// Strips empty params so they never reach the API as ?search=.
export const cleanParams = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
