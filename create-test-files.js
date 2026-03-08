const XLSX = require("xlsx");

// File 1: Fee Transactions
const feeData = [
  { "Fee Code": "3004", "Fee Amount": 1500.00, "Currency": "USD", "Transaction Date": "2025-01-15" },
  { "Fee Code": "3004", "Fee Amount": 2300.50, "Currency": "USD", "Transaction Date": "2025-01-20" },
  { "Fee Code": "3004", "Fee Amount": 800.00, "Currency": "EUR", "Transaction Date": "2025-02-01" },
  { "Fee Code": "3032", "Fee Amount": 5000.00, "Currency": "GBP", "Transaction Date": "2025-01-10" },
  { "Fee Code": "3032", "Fee Amount": 3200.00, "Currency": "GBP", "Transaction Date": "2025-02-15" },
  { "Fee Code": "3032", "Fee Amount": 1100.00, "Currency": "USD", "Transaction Date": "2025-03-01" },
  { "Fee Code": "3055", "Fee Amount": 750.00, "Currency": "EUR", "Transaction Date": "2025-01-25" },
  { "Fee Code": "3055", "Fee Amount": 420.00, "Currency": "EUR", "Transaction Date": "2025-02-10" },
  { "Fee Code": "3055", "Fee Amount": 980.00, "Currency": "USD", "Transaction Date": "2025-03-05" },
  { "Fee Code": "3071", "Fee Amount": 15000.00, "Currency": "JPY", "Transaction Date": "2025-01-30" },
  { "Fee Code": "3071", "Fee Amount": 22000.00, "Currency": "JPY", "Transaction Date": "2025-02-20" },
  { "Fee Code": "3071", "Fee Amount": 600.00, "Currency": "USD", "Transaction Date": "2025-03-10" },
];
const wb1 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb1, XLSX.utils.json_to_sheet(feeData), "Fees");
XLSX.writeFile(wb1, "test_fee_transactions.xlsx");

// File 2: Exchange Rates
const exchangeData = [
  { "Currency Code": "USD", "Exchange Rate": 1.00 },
  { "Currency Code": "EUR", "Exchange Rate": 1.08 },
  { "Currency Code": "GBP", "Exchange Rate": 1.27 },
  { "Currency Code": "JPY", "Exchange Rate": 0.0067 },
];
const wb2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(exchangeData), "Rates");
XLSX.writeFile(wb2, "test_exchange_rates.xlsx");

// File 3: GL Data
const glData = [
  { "Fee Code": "3004", "GL Amount (USD)": 4664.40 },
  { "Fee Code": "3032", "GL Amount (USD)": 11614.00 },
  { "Fee Code": "3055", "GL Amount (USD)": 2250.00 },
  { "Fee Code": "3071", "GL Amount (USD)": 850.00 },
];
const wb3 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb3, XLSX.utils.json_to_sheet(glData), "GL");
XLSX.writeFile(wb3, "test_gl_data.xlsx");

console.log("Created 3 test files!");
console.log("1. test_fee_transactions.xlsx (12 rows)");
console.log("2. test_exchange_rates.xlsx (4 currencies)");
console.log("3. test_gl_data.xlsx (4 fee codes)");
