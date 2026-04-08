import { useState } from "react";
import type { Pagination } from "../types";
import { DEFAULT_TABLE_SIZE } from "../utils/constants";

const usePagination = () => {
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    size: DEFAULT_TABLE_SIZE,
    order: { field: "created_at", isAscendent: false },
  });

  const setPage = (page: number) => setPagination((p) => ({ ...p, page }));

  const setOrder = (field: string) =>
    setPagination((p) => ({
      ...p,
      page: 1,
      order: {
        field,
        isAscendent: p.order.field === field ? !p.order.isAscendent : true,
      },
    }));

  return { pagination, setPage, setOrder };
};

export default usePagination;
