import assert from "node:assert/strict";
import type { ClientSession } from "mongoose";
import { withTransactionRetry } from "../utils/transaction";

// Cô lập session; không kết nối database hoặc thực hiện giao dịch tiền thật.
async function run() {
  for (const failure of [new Error("Lỗi nghiệp vụ"), { code: 112, errorLabels: ["UnknownTransactionCommitResult"] }]) {
    let calls = 0;
    const session = { withTransaction: async () => { calls++; throw failure; } } as unknown as ClientSession;
    await assert.rejects(withTransactionRetry(session, async () => {}), error => error === failure);
    assert.equal(calls, 1, "Không tự chạy lại nghiệp vụ hoặc giao dịch chưa rõ kết quả commit.");
  }
  let calls = 0;
  const conflict = Object.assign(new Error("Xung đột ghi"), { code: 112 });
  const session = { withTransaction: async () => { calls++; throw conflict; } } as unknown as ClientSession;
  await assert.rejects(withTransactionRetry(session, async () => {}), error => error === conflict);
  assert.equal(calls, 3, "Số lần thử lại có giới hạn.");
  console.log("Đạt thử lại transaction: chỉ lỗi xung đột ghi, giới hạn số lượt và không chạy lại khi chưa rõ commit.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
