export const fixedScopeLimits = {
  maxRows: 300,
  maxColumns: 12
};

const paymentUrl = "https://paypal.me/yp1233/10USD";
const requestUrl = "https://github.com/didixyy/remote-freelancer-first-sale-kit/issues/new?template=csv-cleanup.yml";
const contactEmail = "331596501@qq.com";

export function normalizePositiveInteger(value) {
  const text = String(value ?? "").trim();

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  return Number(text);
}

function normalizeOption(value, fallback) {
  const text = String(value ?? "").trim().toLowerCase();
  return text.length > 0 ? text : fallback;
}

function buildBrief({
  rowCount,
  columnCount,
  fileType,
  cleanupType,
  status,
  nextAction
}) {
  return [
    "Hi,",
    "",
    "I want to confirm a 10 USD CSV cleanup task.",
    "",
    `Task type: ${cleanupType}`,
    `File type: ${fileType}`,
    `Row count: ${rowCount ?? ""}`,
    `Column count: ${columnCount ?? ""}`,
    `Scope result: ${status}`,
    "",
    "Payment sender email:",
    "File or brief:",
    "Deadline:",
    "Anything to avoid changing:",
    "Expected result:",
    "",
    nextAction,
    `Payment link: ${paymentUrl}`,
    `Request form: ${requestUrl}`
  ].join("\n");
}

export function evaluateScope(input) {
  const rowCount = normalizePositiveInteger(input?.rowCount);
  const columnCount = normalizePositiveInteger(input?.columnCount);
  const fileType = normalizeOption(input?.fileType, "csv");
  const cleanupType = normalizeOption(input?.cleanupType, "general-csv");

  if (rowCount === null || columnCount === null) {
    const nextAction = "Enter whole-number row and column counts.";

    return {
      status: "needs-input",
      canPayNow: false,
      paymentUrl,
      requestUrl,
      nextAction,
      reasons: ["Both row count and column count must be whole numbers above zero."],
      brief: buildBrief({
        rowCount,
        columnCount,
        fileType,
        cleanupType,
        status: "needs-input",
        nextAction
      })
    };
  }

  const reasons = [];

  if (rowCount > fixedScopeLimits.maxRows) {
    reasons.push("Row count is over the 300 row fixed-scope limit.");
  }

  if (columnCount > fixedScopeLimits.maxColumns) {
    reasons.push("Column count is over the 12 column fixed-scope limit.");
  }

  if (reasons.length > 0) {
    const nextAction = "Open the request form before paying.";

    return {
      status: "scope-review",
      canPayNow: false,
      paymentUrl,
      requestUrl,
      nextAction,
      reasons,
      brief: buildBrief({
        rowCount,
        columnCount,
        fileType,
        cleanupType,
        status: "scope-review",
        nextAction
      })
    };
  }

  const nextAction = "Pay 10 USD, then email the paid cleanup brief.";

  return {
    status: "fixed-scope",
    canPayNow: true,
    paymentUrl,
    requestUrl,
    nextAction,
    reasons: [`One ${fileType} file is within 300 rows and 12 columns.`],
    brief: buildBrief({
      rowCount,
      columnCount,
      fileType,
      cleanupType,
      status: "fixed-scope",
      nextAction
    })
  };
}

export function buildScopeEmail(result, paymentSenderEmail) {
  const senderEmail = String(paymentSenderEmail ?? "").trim();
  const subject = result?.canPayNow ? "Paid 10 USD CSV cleanup" : "CSV cleanup scope review";
  const body = [
    result?.brief ?? "",
    "",
    `Payment sender email: ${senderEmail}`,
    "",
    result?.canPayNow
      ? `I paid or will pay here: ${paymentUrl}`
      : `Please review scope before payment: ${requestUrl}`
  ].join("\n");

  return `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
