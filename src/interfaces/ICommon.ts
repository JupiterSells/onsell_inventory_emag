export interface EmagApiResponse<T = any> {
  isError: boolean;
  messages: string[];
  results: T;
}

export interface PaginationParams {
  currentPage?: number;
  itemsPerPage?: number;
}

export interface CountResponse {
  isError: boolean;
  messages: string[];
  results: number;
}
