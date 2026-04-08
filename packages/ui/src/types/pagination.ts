export type Pagination = {
  page: number;
  size: number;
  order: { field: string; isAscendent: boolean };
};
