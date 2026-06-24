import { useCallback, useState } from "react";

export interface CursorPaginationState {
  currentToken: string | undefined;
  pageSize: number;
  /** Current page number (1-indexed) */
  pageNumber: number;
  /** Total number of pages visited so far */
  maxPageVisited: number;
  /** @deprecated use pageNumber instead */
  tokenStack: string[];
}

export interface CursorPaginationActions {
  goNext: (nextToken: string) => void;
  goPrev: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * 管理游標式分頁邏輯，支援跳頁。
 *
 * 內部維護一個 tokenMap：page number → token，
 * 已瀏覽過的頁面可以直接跳回。
 *
 * - 第 1 頁 token = undefined（首頁不需要 token）
 * - goNext(nextToken)：記錄下一頁的 token，前進到下一頁
 * - goPrev()：回到前一頁
 * - goToPage(n)：跳到已瀏覽過的第 n 頁
 * - reset / setPageSize：清空所有記錄，回到第 1 頁
 */
export function useCursorPagination(
  initialPageSize: number = DEFAULT_PAGE_SIZE,
): CursorPaginationState & CursorPaginationActions {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);
  // tokenMap: page number → token for that page (page 1 = undefined)
  const [tokenMap, setTokenMap] = useState<Map<number, string | undefined>>(
    () => new Map([[1, undefined]]),
  );

  const currentToken = tokenMap.get(pageNumber);
  const maxPageVisited = tokenMap.size;

  const goNext = useCallback(
    (nextToken: string): void => {
      const nextPage = pageNumber + 1;
      setTokenMap((prev) => {
        const next = new Map(prev);
        next.set(nextPage, nextToken);
        return next;
      });
      setPageNumber(nextPage);
    },
    [pageNumber],
  );

  const goPrev = useCallback((): void => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  }, [pageNumber]);

  const goToPage = useCallback(
    (page: number): void => {
      if (page >= 1 && tokenMap.has(page)) {
        setPageNumber(page);
      }
    },
    [tokenMap],
  );

  const setPageSize = useCallback((size: number): void => {
    setPageSizeState(size);
    setTokenMap(new Map([[1, undefined]]));
    setPageNumber(1);
  }, []);

  const reset = useCallback((): void => {
    setTokenMap(new Map([[1, undefined]]));
    setPageNumber(1);
  }, []);

  // Backward compat: tokenStack for hasPrevPage check
  const tokenStack = Array.from(
    { length: pageNumber - 1 },
    (_, i) => tokenMap.get(i + 1) ?? "",
  );

  return {
    currentToken,
    pageSize,
    pageNumber,
    maxPageVisited,
    tokenStack,
    goNext,
    goPrev,
    goToPage,
    setPageSize,
    reset,
  };
}
