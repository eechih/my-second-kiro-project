import { useCallback, useState } from "react";

export interface CursorPaginationState {
  currentToken: string | undefined;
  pageSize: number;
  tokenStack: string[];
}

export interface CursorPaginationActions {
  goNext: (nextToken: string) => void;
  goPrev: () => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * 管理游標式分頁的 token 堆疊邏輯。
 *
 * Token 堆疊運作方式：
 * - 首頁：currentToken = undefined，tokenStack = []
 * - goNext：將 currentToken push 到 tokenStack（若為 undefined 則不 push），設定新 currentToken
 * - goPrev：從 tokenStack pop 出前一個 token 作為 currentToken；若堆疊為空則回到首頁（undefined）
 * - reset / setPageSize：清空 tokenStack，currentToken = undefined
 */
export function useCursorPagination(
  initialPageSize: number = DEFAULT_PAGE_SIZE,
): CursorPaginationState & CursorPaginationActions {
  const [currentToken, setCurrentToken] = useState<string | undefined>(
    undefined,
  );
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);
  const [tokenStack, setTokenStack] = useState<string[]>([]);

  const goNext = useCallback(
    (nextToken: string): void => {
      if (currentToken !== undefined) {
        setTokenStack((prev) => [...prev, currentToken]);
      }
      setCurrentToken(nextToken);
    },
    [currentToken],
  );

  const goPrev = useCallback((): void => {
    setTokenStack((prev) => {
      if (prev.length === 0) {
        setCurrentToken(undefined);
        return prev;
      }
      const newStack = [...prev];
      const prevToken = newStack.pop();
      setCurrentToken(prevToken);
      return newStack;
    });
  }, []);

  const setPageSize = useCallback((size: number): void => {
    setPageSizeState(size);
    setTokenStack([]);
    setCurrentToken(undefined);
  }, []);

  const reset = useCallback((): void => {
    setTokenStack([]);
    setCurrentToken(undefined);
  }, []);

  return {
    currentToken,
    pageSize,
    tokenStack,
    goNext,
    goPrev,
    setPageSize,
    reset,
  };
}
