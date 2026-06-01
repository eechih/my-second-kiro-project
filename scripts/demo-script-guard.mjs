import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const LOCAL_MARKER_FILE = ".demo-scripts.local";

export async function assertLocalDemoScriptEnvironment() {
  if (process.env["CI"]) {
    throw new Error("Demo scripts 禁止在 CI 環境執行");
  }

  try {
    await access(
      new URL(`../${LOCAL_MARKER_FILE}`, import.meta.url),
      fsConstants.F_OK,
    );
  } catch {
    throw new Error(
      [
        "Demo scripts 僅允許在本機環境執行。",
        `請在專案根目錄建立未追蹤檔案：${LOCAL_MARKER_FILE}`,
      ].join("\n"),
    );
  }
}
