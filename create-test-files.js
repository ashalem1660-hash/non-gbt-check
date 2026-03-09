const XLSX = require("xlsx");

// File 1: Fee Transactions
const feeData = [
  { "Fee Code": "3004", "Fee Amount": 1500.00, "Currency": "USD", "Transaction Date": "2025-01-15" },
  { "Fee Code": "3004", "Fee Amount": 2300.50, "Currency": "USD", "Transaction Date": "2025-01-20" },
  { "Fee Code": "3004", "Fee Amount": 800.00, "Currency": "EUR", "Transaction Date": "2025-01-15" },
  { "Fee Code": "3032", "Fee Amount": 5000.00, "Currency": "GBP", "Transaction Date": "2025-01-10" },
  { "Fee Code": "3032", "Fee Amount": 3200.00, "Currency": "GBP", "Transaction Date": "2025-01-20" },
  { "Fee Code": "3032", "Fee Amount": 1100.00, "Currency": "USD", "Transaction Date": "2025-01-25" },
  { "Fee Code": "3055", "Fee Amount": 750.00, "Currency": "EUR", "Transaction Date": "2025-01-10" },
  { "Fee Code": "3055", "Fee Amount": 420.00, "Currency": "EUR", "Transaction Date": "2025-01-20" },
  { "Fee Code": "3055", "Fee Amount": 980.00, "Currency": "USD", "Transaction Date": "2025-01-25" },
  { "Fee Code": "3071", "Fee Amount": 15000.00, "Currency": "JPY", "Transaction Date": "2025-01-15" },
  { "Fee Code": "3071", "Fee Amount": 22000.00, "Currency": "JPY", "Transaction Date": "2025-01-20" },
  { "Fee Code": "3071", "Fee Amount": 600.00, "Currency": "USD", "Transaction Date": "2025-01-25" },
  { "Fee Code": "3099", "Fee Amount": 500.00, "Currency": "CHF", "Transaction Date": "2025-02-05" },
];
const wb1 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb1, XLSX.utils.json_to_sheet(feeData), "Fees");
XLSX.writeFile(wb1, "test_fee_transactions.xlsx");

// File 2: Exchange Rates WITH DATES
const exchangeData = [
  { "Date": "2025-01-10", "Currency": "EUR", "Rate": 1.08 },
  { "Date": "2025-01-10", "Currency": "GBP", "Rate": 1.27 },
  { "Date": "2025-01-10", "Currency": "JPY", "Rate": 0.0067 },
  { "Date": "2025-01-15", "Currency": "EUR", "Rate": 1.085 },
  { "Date": "2025-01-15", "Currency": "GBP", "Rate": 1.272 },
  { "Date": "2025-01-15", "Currency": "JPY", "Rate": 0.0066 },
  { "Date": "2025-01-20", "Currency": "EUR", "Rate": 1.09 },
  { "Date": "2025-01-20", "Currency": "GBP", "Rate": 1.275 },
  { "Date": "2025-01-20", "Currency": "JPY", "Rate": 0.0065 },
  { "Date": "2025-01-25", "Currency": "EUR", "Rate": 1.087 },
  { "Date": "2025-01-25", "Currency": "GBP", "Rate": 1.268 },
  { "Date": "2025-01-25", "Currency": "JPY", "Rate": 0.0068 },
];
const wb2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(exchangeData), "Rates");
XLSX.writeFile(wb2, "test_exchange_rates.xlsx");

// File 3: GL Data
const glData = [
  { "Fee Code": "3004", "GL Amount (USD)": 4670.00 },
  { "Fee Code": "3032", "GL Amount (USD)": 11550.00 },
  { "Fee Code": "3055", "GL Amount (USD)": 2260.00 },
  { "Fee Code": "3071", "GL Amount (USD)": 840.00 },
];
const wb3 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb3, XLSX.utils.json_to_sheet(glData), "GL");
XLSX.writeFile(wb3, "test_gl_data.xlsx");

console.log("Test files created with DAILY exchange rates!");
console.log("1. test_fee_transactions.xlsx (13 rows - includes CHF with NO rate to test error)");
console.log("2. test_exchange_rates.xlsx (12 rows - daily rates for EUR, GBP, JPY)");
console.log("3. test_gl_data.xlsx (4 fee codes)");
console.log("");
console.log("Expected behavior:");
console.log("- CHF transaction should show as ERROR (no exchange rate)");
console.log("- USD transactions should use rate of 1");
console.log("- EUR/GBP/JPY should use daily rates matching transaction dates");
