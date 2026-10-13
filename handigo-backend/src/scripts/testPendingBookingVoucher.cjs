const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const webRoot = path.resolve(__dirname, "../../../handigo-web");
const React = require(path.join(webRoot, "node_modules/react"));
const { renderToStaticMarkup } = require(path.join(webRoot, "node_modules/react-dom/server"));
const sourcePath = path.join(webRoot, "src/features/booking/pages/ConfirmPaymentPage.tsx");
let locked = true;
let pickerRenders = 0;
const order = { depositAmount: 20000, pricing: { bookingAmount: 200000, totalPaidAmount: 170000,
  promotionDiscountAmount: 0, voucherDiscountAmount: 30000 }, voucherSnapshot: { code: "CU30" } };
const stubs = {
  "react/jsx-runtime": require(path.join(webRoot, "node_modules/react/jsx-runtime")),
  "../components/BookingComponents": {
    BookingStepper: () => null,
    OrderCreationShell: ({ children }) => React.createElement("div", null, children),
    OrderSummaryCard: ({ summaryContent, skipPricePreview, priceSnapshot }) => {
      if (locked) {
        assert.equal(skipPricePreview, true);
        assert.equal(priceSnapshot.discountedAmount, 170000, "Giá phải lấy từ đơn đã tạo, không tính lại theo mã mới.");
      }
      return summaryContent;
    },
  },
  "../components/ConfirmPaymentServiceDetails": { ConfirmPaymentServiceDetails: () => null },
  "../components/ConfirmPaymentMethodSelector": { ConfirmPaymentMethodSelector: () => null },
  "../components/ConfirmPaymentVoucherPanel": { ConfirmPaymentVoucherPanel: () => {
    pickerRenders++; return React.createElement("input", { "aria-label": "Chọn voucher" });
  } },
  "../components/useConfirmPaymentFlow": { useConfirmPaymentFlow: () => ({
    voucherLocked: locked, pendingOrder: locked ? order : undefined,
    voucherCode: "MOI30", appliedVoucher: { code: "MOI30" }, availableVouchers: [],
  }) },
};
const loaded = new Module(sourcePath);
loaded.require = (name) => { if (!(name in stubs)) throw new Error(`Chưa giả lập ${name}.`); return stubs[name]; };
loaded._compile(ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, sourcePath);
const html = renderToStaticMarkup(React.createElement(loaded.exports.default));
assert.ok(html.includes("CU30")); assert.equal(html.includes("MOI30"), false);
assert.equal(pickerRenders, 0, "Đơn đang chờ không được hiển thị form đổi/gỡ voucher.");
locked = false;
renderToStaticMarkup(React.createElement(loaded.exports.default));
assert.equal(pickerRenders, 1, "Đơn chưa tạo vẫn được chọn voucher như trước.");
console.log("Đạt: đơn chờ hiển thị giá/mã đã chốt và khóa form voucher; đơn mới vẫn được chọn mã.");
