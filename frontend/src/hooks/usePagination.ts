import { useMemo, useState } from 'react';

export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const resetPage = () => setPage(1);

  const paginationProps = useMemo(
    () => ({ page, limit, setPage, setLimit, resetPage }),
    [page, limit]
  );

  return paginationProps;
};