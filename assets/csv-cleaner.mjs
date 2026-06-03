const DELIMITER_CANDIDATES = [",", "\t", ";", "|"];

function normalizeLineEndings(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0 || text.endsWith(delimiter)) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(text) {
  let bestDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const rows = parseRows(text, delimiter)
      .map((row) => row.filter((cell) => cell.trim().length > 0).length)
      .filter((cellCount) => cellCount > 0);
    const multiColumnRows = rows.filter((cellCount) => cellCount > 1);
    const totalColumns = rows.reduce((sum, cellCount) => sum + cellCount, 0);
    const score = multiColumnRows.length * 100 + totalColumns;

    if (score > bestScore) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

function toTitleCase(text) {
  return text
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function buildHeaders(rawHeaders, columnCount) {
  const seen = new Map();
  const headers = [];

  for (let index = 0; index < columnCount; index += 1) {
    const rawHeader = rawHeaders[index] ?? "";
    const baseName = toTitleCase(rawHeader) || `Column ${index + 1}`;
    const currentCount = seen.get(baseName) ?? 0;
    seen.set(baseName, currentCount + 1);
    headers.push(currentCount === 0 ? baseName : `${baseName} ${currentCount + 1}`);
  }

  return headers;
}

function isBlankRow(row) {
  return row.every((cell) => cell.trim().length === 0);
}

function normalizeCell(value, header) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const headerKey = header.toLowerCase();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  if (headerKey.includes("email") || looksLikeEmail) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function fitRowToColumns(row, columnCount) {
  const fitted = row.slice(0, columnCount);

  while (fitted.length < columnCount) {
    fitted.push("");
  }

  return fitted;
}

export function cleanDelimitedText(input) {
  const text = normalizeLineEndings(String(input ?? ""));
  const delimiter = detectDelimiter(text);
  const parsedRows = parseRows(text, delimiter).map((row) => row.map((cell) => cell.trim()));
  const firstDataIndex = parsedRows.findIndex((row) => !isBlankRow(row));

  if (firstDataIndex === -1) {
    return {
      headers: [],
      rows: [],
      stats: {
        originalRows: 0,
        cleanedRows: 0,
        removedBlankRows: 0,
        removedDuplicateRows: 0,
        columns: 0,
        delimiter
      }
    };
  }

  const rawHeaders = parsedRows[firstDataIndex];
  const rawDataRows = parsedRows.slice(firstDataIndex + 1);
  const columnCount = Math.max(
    rawHeaders.length,
    ...rawDataRows.map((row) => row.length),
    1
  );
  const headers = buildHeaders(rawHeaders, columnCount);
  const rows = [];
  const fingerprints = new Set();
  let removedBlankRows = 0;
  let removedDuplicateRows = 0;

  for (const rawRow of rawDataRows) {
    const fittedRow = fitRowToColumns(rawRow, columnCount);

    if (isBlankRow(fittedRow)) {
      removedBlankRows += 1;
      continue;
    }

    const cleanRow = fittedRow.map((cell, index) => normalizeCell(cell, headers[index]));
    const fingerprint = cleanRow.map((cell) => cell.toLowerCase()).join("\u001f");

    if (fingerprints.has(fingerprint)) {
      removedDuplicateRows += 1;
      continue;
    }

    fingerprints.add(fingerprint);
    rows.push(cleanRow);
  }

  return {
    headers,
    rows,
    stats: {
      originalRows: rawDataRows.length,
      cleanedRows: rows.length,
      removedBlankRows,
      removedDuplicateRows,
      columns: columnCount,
      delimiter
    }
  };
}

function quoteCsvCell(value) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(quoteCsvCell).join(","))
    .join("\n");
}

export function buildCleanupBrief(result) {
  const stats = result?.stats ?? {};
  const headers = Array.isArray(result?.headers) ? result.headers : [];
  const cleanedRows = stats.cleanedRows ?? 0;
  const removedBlankRows = stats.removedBlankRows ?? 0;
  const removedDuplicateRows = stats.removedDuplicateRows ?? 0;
  const columns = stats.columns ?? headers.length;
  const headerLine = headers.length > 0 ? headers.join(", ") : "not sure";

  return [
    "Hi,",
    "",
    "I want to confirm a 10 USD spreadsheet cleanup task.",
    "",
    "Quick tool result:",
    `Rows after quick cleanup: ${cleanedRows}`,
    `Blank rows removed by the tool: ${removedBlankRows}`,
    `Duplicate rows removed by the tool: ${removedDuplicateRows}`,
    `Detected columns: ${columns}`,
    `Column names: ${headerLine}`,
    "",
    "What I need checked manually:",
    "- Please review whether the cleanup result is readable.",
    "- Please return a cleaned CSV or Excel workbook.",
    "- Please include a short note explaining what changed.",
    "",
    "Please confirm scope before I pay.",
    "Contact: 331596501@qq.com",
    "Payment after scope confirmation: https://paypal.me/yp1233/10USD"
  ].join("\n");
}
