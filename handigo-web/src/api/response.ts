export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination?: PaginationResponse;
}

export const unwrap = <T>(response: { data: ApiResponse<T> }) =>
  response.data.data;
