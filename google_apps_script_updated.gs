// Apps Script for TET Quiz — robust J–AM writer with flexible input and coloring

function doPost(e) {
  // 1) Parse JSON safely
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "BadRequest", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 2) Resolve sheet by quizName; robust matching; create if missing
  var rawQuizName = (data.quizName || "").toString().trim();
  var sheet = getOrCreateSheet(ss, rawQuizName);

  // 3) Append meta (A..I)
  var rowMeta = [
    new Date(),
    data.name || "",
    data.email || "",
    data.phone || "",
    data.subject || "",
    Number(data.attempted || 0),
    Number(data.unattempted || 0),
    Number(data.score || 0),
    data.timeTaken || ""
  ];
  sheet.appendRow(rowMeta);
  var rowIndex = sheet.getLastRow(); // correct way to get the appended row index

  // 4) Build answers array from any provided field (arrays or CSV)
  var answersArr = pickAnswersArray(data); // returns 30-length array of uppercase strings or ""

  // 5) Write answers to J–AM in one shot
  sheet.getRange(rowIndex, 10, 1, 30).setValues([answersArr]);

  // 6) Optionally color codes using answer key (from AnswerKeys or fallback map)
  var resolvedName = sheet.getName(); // use the actual sheet name for key lookup
  var key = getKeyFromSheet(ss, resolvedName) || getHardcodedKey(resolvedName);
  if (key && Array.isArray(key)) {
    key = key.map(function (x) { return ("" + x).trim().toUpperCase(); });
    for (var i = 0; i < 30; i++) {
      var cell = sheet.getRange(rowIndex, 10 + i);
      var ans = answersArr[i];
      if (!ans) {
        cell.setFontColor("black");
      } else if (key[i] && ans === key[i]) {
        cell.setFontColor("green");
      } else {
        cell.setFontColor("red");
      }
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: "Success", sheet: resolvedName, row: rowIndex }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: "OK", message: "TET Quiz System API" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pick answers array from multiple possible fields:
 * - answers (["A","B",...])
 * - answerCodes (["A","B",...])
 * - answersCsv ("A,B,...")
 * - answerCodesCsv ("A,B,...")
 * Returns an array of exactly 30 uppercase strings ("" for blank).
 */
function pickAnswersArray(data) {
  var arr = [];
  if (data.answers && data.answers.length) {
    arr = data.answers;
  } else if (data.answerCodes && data.answerCodes.length) {
    arr = data.answerCodes;
  } else if (data.answersCsv) {
    arr = String(data.answersCsv).split(/[\s,]+/);
  } else if (data.answerCodesCsv) {
    arr = String(data.answerCodesCsv).split(/[\s,]+/);
  }

  // Normalize to uppercase, keep empty for unanswered
  arr = (arr || []).map(function (x) {
    var v = (x == null ? "" : ("" + x)).trim().toUpperCase();
    return v; // could validate A-D if you want, but leave as-is
  });

  // Ensure exactly 30 cells (pad with empty, trim extras)
  while (arr.length < 30) arr.push("");
  if (arr.length > 30) arr = arr.slice(0, 30);

  return arr;
}

/**
 * Resolve or create a sheet for the given quizName.
 * Matching strategy:
 * 1. Exact
 * 2. Ignore spaces, case
 * 3. Ignore all non-alphanumerics (case-insensitive)
 * If still not found and quizName present: create a new sheet with headers.
 * If no quizName, fallback to the first sheet.
 */
function getOrCreateSheet(ss, quizName) {
  var sheets = ss.getSheets();

  function normSpaces(name) { return String(name).replace(/\s+/g, "").toLowerCase(); }
  function normAggressive(name) { return String(name).toLowerCase().replace(/[^a-z0-9]/g, ""); }

  var sheet = null;

  if (quizName) {
    // 1) Exact
    sheet = ss.getSheetByName(quizName);

    // 2) Ignore spaces, case
    if (!sheet) {
      var targetCompact = normSpaces(quizName);
      for (var i = 0; i < sheets.length; i++) {
        if (normSpaces(sheets[i].getName()) === targetCompact) { sheet = sheets[i]; break; }
      }
    }

    // 3) Ignore non-alphanumerics
    if (!sheet) {
      var targetAgg = normAggressive(quizName);
      for (var j = 0; j < sheets.length; j++) {
        if (normAggressive(sheets[j].getName()) === targetAgg) { sheet = sheets[j]; break; }
      }
    }

    // Create if still not found
    if (!sheet) {
      sheet = ss.insertSheet(quizName);
      setupHeaders(sheet);
    }
  }

  // Fallback: use first sheet
  if (!sheet) {
    sheet = sheets[0];
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== "Timestamp") {
      setupHeaders(sheet); // ensure headers exist
    }
  }

  // Ensure headers exist (idempotent)
  ensureHeaders(sheet);

  return sheet;
}

/** Create header row (A..AM) if missing */
function setupHeaders(sheet) {
  var headers = [
    "Timestamp", "Name", "Email", "Phone", "Subject",
    "Attempted", "Unattempted", "Score", "Time Taken"
  ];
  for (var i = 1; i <= 30; i++) headers.push("Q" + i);

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold").setBackground("#f0f0f0");
}

/** Ensure header row is present (add if missing) */
function ensureHeaders(sheet) {
  var firstRow = sheet.getRange(1, 1, 1, 39).getValues()[0];
  if (!firstRow || String(firstRow[0]).trim() !== "Timestamp") {
    setupHeaders(sheet);
  }
}

/**
 * Try to read keys from an "AnswerKeys" sheet (column A=quizName, B=CSV).
 * Matching is case-insensitive on quiz name.
 */
function getKeyFromSheet(ss, quizName) {
  var ks = ss.getSheetByName("AnswerKeys");
  if (!ks) return null;

  try {
    var vals = ks.getDataRange().getValues();
    var norm = function(x){ return String(x || '').toLowerCase().replace(/[^a-z0-9]/g,''); };
    var target = norm(quizName);
    for (var r = 0; r < vals.length; r++) {
      var q = vals[r][0];
      var csv = vals[r][1];
      if (!q || !csv) continue;
      if (norm(q) === target) {
        var arr = String(csv).split(/[\s,]+/).filter(function (x) { return x && x.length > 0; });
        return arr.map(function (x) { return x.toUpperCase(); });
      }
    }
  } catch (e) {
    // swallow errors; coloring is optional
  }

  return null;
}

/**
 * Minimal hardcoded fallback answer keys.
 * Used only when AnswerKeys sheet is not defined.
 */
function getHardcodedKey(quizName) {
  var map = {
    "test-01": ["C","B","A","D","B","A","C","B","C","D","B","C","C","A","D","B","A","D","C","A","A","C","D","A","B","D","B","D","A","B"],
    "test-02": ["C","B","D","D","C","C","B","D","B","B","D","B","B","A","B","D","B","D","C","A","C","C","A","A","B","B","A","D","C","C"],
    "test-03": ["C","B","B","A","B","A","C","A","B","B","C","D","B","B","A","B","C","C","A","D","A","A","D","B","D","B","A","A","B","A"],
  "test-04": ["A","C","B","A","C","D","C","A","C","C","B","C","B","B","A","A","A","D","A","B","C","B","C","B","B","B","B","C","A","B"],
  "test-05": ["B","C","D","A","C","C","B","C","A","C","B","C","C","C","B","C","A","D","C","A","D","B","A","C","C","B","C","B","B","B"],
    "Test1": ["C","B","A","D","B","A","B","B","C","B","B","C","C","A","D","B","A","D","C","A","A","C","D","A","B","D","B","D","A","B"],
    "Test2": ["C","B","D","D","C","C","B","D","B","B","D","B","B","A","B","D","B","D","C","A","C","C","A","A","B","B","A","D","C","C"]
  };

  // Exact
  if (map[quizName]) return map[quizName];

  // Ignore spaces/case
  var compact = String(quizName || "").replace(/\s+/g, "").toLowerCase();
  for (var k in map) {
    if (k.replace(/\s+/g, "").toLowerCase() === compact) {
      return map[k];
    }
  }
  return null;
}
// Updated Google Apps Script for TET Quiz System
// Handles multiple tests with separate sheets and option code coloring

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ result: "BadRequest", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Determine sheet name robustly
  var rawQuizName = (data.quizName || "").toString().trim();
  var sheet = null;
  
  if (rawQuizName) {
    sheet = ss.getSheetByName(rawQuizName);
    if (!sheet) {
      // Try ignoring spaces and case
      var compact = rawQuizName.replace(/\s+/g, "");
      var sheets = ss.getSheets();
      for (var s = 0; s < sheets.length; s++) {
        if (sheets[s].getName().replace(/\s+/g,'').toLowerCase() === compact.toLowerCase()) {
          sheet = sheets[s];
          break;
        }
      }
    }
    if (!sheet) {
      // Try aggressive normalization: strip all non-alphanumerics
      var norm = function(x){ return String(x).toLowerCase().replace(/[^a-z0-9]/g,''); };
      var target = norm(rawQuizName);
      var sheets2 = ss.getSheets();
      for (var s2 = 0; s2 < sheets2.length; s2++) {
        if (norm(sheets2[s2].getName()) === target) { sheet = sheets2[s2]; break; }
      }
    }
    
    // If sheet doesn't exist, create it
    if (!sheet) {
      sheet = ss.insertSheet(rawQuizName);
      // Add headers to new sheet
      var headers = [
        "Timestamp", "Name", "Email", "Phone", "Subject", 
        "Attempted", "Unattempted", "Score", "Time Taken",
        "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
        "Q11", "Q12", "Q13", "Q14", "Q15", "Q16", "Q17", "Q18", "Q19", "Q20",
        "Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q27", "Q28", "Q29", "Q30"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f0f0f0");
    }
  }
  
  if (!sheet) {
    // Fallback to first sheet (preserve old behavior)
    sheet = ss.getSheets()[0];
  }

  // Build initial row (columns 1..9)
  var rowMeta = [
    new Date(),
    data.name || "",
    data.email || "",
    data.phone || "",
    data.subject || "",
    data.attempted || 0,
    data.unattempted || 0,
    data.score || 0,
    data.timeTaken || ""
  ];

  // Append meta first, then we'll fill answers and color them
  sheet.appendRow(rowMeta);
  var lastRow = sheet.getLastRow();

  // Get the answer key for this quiz
  var key = getKeyFromSheet(ss, rawQuizName);
  if (!key) {
    key = getHardcodedKey(rawQuizName);
  }
  
  // Ensure key is uppercase array or null
  if (key && Array.isArray(key)) {
    key = key.map(function(x){ return (""+x).trim().toUpperCase(); });
  } else {
    key = null;
  }

  // Choose answers array: prefer data.answers, fallback to data.answerCodes or CSVs
  var answersArr = null;
  if (data.answers && data.answers.length) answersArr = data.answers;
  else if (data.answerCodes && data.answerCodes.length) answersArr = data.answerCodes;
  else if (data.answersCsv) answersArr = String(data.answersCsv).split(/[\s,]+/);
  else if (data.answerCodesCsv) answersArr = String(data.answerCodesCsv).split(/[\s,]+/);

  // Write answers into columns 10..39 (30 answers) with coloring
  for (var i = 0; i < 30; i++) {
    var rawAns = answersArr && answersArr[i] ? answersArr[i] : "";
    var ans = (""+rawAns).trim().toUpperCase();
    var col = 10 + i; // answers start at column 10
    var cell = sheet.getRange(lastRow, col);
    
    // Set the answer value
    cell.setValue(ans === "" ? "" : ans);

    // Apply coloring based on correctness
    if (ans === "" || !key) {
      cell.setFontColor("black");
      cell.setBackground("white");
    } else {
  var correct = key[i];
      if (correct && ans === correct.toString().toUpperCase()) {
        cell.setFontColor("green");
        cell.setFontWeight("bold");
        cell.setBackground("#e8f5e8"); // light green background
      } else {
        cell.setFontColor("red");
        cell.setFontWeight("bold");
        cell.setBackground("#ffe8e8"); // light red background
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ result: "Success", sheet: rawQuizName }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ result: "OK", message: "TET Quiz System API" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Try to read keys from an "AnswerKeys" sheet (column A=quizName, B=CSV)
function getKeyFromSheet(ss, quizName) {
  var ks = ss.getSheetByName("AnswerKeys");
  if (!ks) return null;
  
  try {
    var vals = ks.getDataRange().getValues();
    for (var r = 0; r < vals.length; r++) {
      var q = vals[r][0];
      var csv = vals[r][1];
      if (!q || !csv) continue;
      if (String(q).trim().toLowerCase() === String(quizName).trim().toLowerCase()) {
        // Split by comma or whitespace
        var arr = String(csv).split(/[,\s]+/).filter(function(x){ return x.length > 0; });
        return arr.map(function(x){ return x.toUpperCase(); });
      }
    }
  } catch (e) {
    console.error("Error reading AnswerKeys sheet:", e);
  }
  
  return null;
}

// Updated hardcoded answer keys with option codes (A, B, C, D)
function getHardcodedKey(quizName) {
  var map = {
    "Test1": ["C","B","A","D","B","A","C","B","C","D","A","C","C","A","D","B","A","D","C","D","A","C","D","A","B","D","B","D","A","B"],
    "test1": ["C","B","A","D","B","A","C","B","C","D","A","C","C","A","D","B","A","D","C","D","A","C","D","A","B","D","B","D","A","B"],
    "Test2": ["C","B","D","D","C","C","B","D","D","B","D","D","B","A","B","D","B","C","D","A","C","C","A","A","C","B","A","D","C","C"],
    "test2": ["C","B","D","D","C","C","B","D","D","B","D","D","B","A","B","D","B","C","D","A","C","C","A","A","C","B","A","D","C","C"],
    "Test3": ["C","B","B","A","B","A","C","A","B","B","C","D","B","B","A","B","C","C","A","D","A","A","D","B","D","B","A","A","B","A"],
    "test3": ["C","B","B","A","B","A","C","A","B","B","C","D","B","B","A","B","C","C","A","D","A","A","D","B","D","B","A","A","B","A"],
    "test-03": ["C","B","B","A","B","A","C","A","B","B","C","D","B","B","A","B","C","C","A","D","A","A","D","B","D","B","A","A","B","A"],
    "Test4": ["A","C","B","A","C","D","C","A","C","C","B","C","B","B","A","A","A","D","A","B","C","B","C","B","B","B","B","C","A","B"],
    "test4": ["A","C","B","A","C","D","C","A","C","C","B","C","B","B","A","A","A","D","A","B","C","B","C","B","B","B","B","C","A","B"],
    "test-04": ["A","C","B","A","C","D","C","A","C","C","B","C","B","B","A","A","A","D","A","B","C","B","C","B","B","B","B","C","A","B"],
    "Test5": ["B","C","D","A","C","C","B","C","A","C","B","C","C","C","B","C","A","D","C","A","D","B","A","C","C","B","C","B","B","B"],
    "test5": ["B","C","D","A","C","C","B","C","A","C","B","C","C","C","B","C","A","D","C","A","D","B","A","C","C","B","C","B","B","B"],
    "test-05": ["B","C","D","A","C","C","B","C","A","C","B","C","C","C","B","C","A","D","C","A","D","B","A","C","C","B","C","B","B","B"]
  };
  
  // Try exact match first
  if (map[quizName]) return map[quizName];
  
  // Try case-insensitive match
  var lowerQuizName = quizName.toLowerCase();
  if (map[lowerQuizName]) return map[lowerQuizName];
  
  // Try without spaces
  var compact = (quizName || "").replace(/\s+/g,'').toLowerCase();
  for (var k in map) {
    if (k.replace(/\s+/g,'').toLowerCase() === compact) {
      return map[k];
    }
  }
  
  return null;
}

// Utility function to create answer key sheet (run once manually if needed)
function createAnswerKeysSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("AnswerKeys");
  
  if (!sheet) {
    sheet = ss.insertSheet("AnswerKeys");
    
    // Add headers
    sheet.getRange(1, 1, 1, 2).setValues([["Quiz Name", "Answer Key (CSV)"]]);
    
    // Add test data
    var answerData = [
      ["Test1", "C,B,A,D,B,A,C,B,C,D,A,C,C,A,D,B,A,D,C,D,A,C,D,A,B,D,B,D,A,B"],
      ["Test2", "C,B,D,D,C,C,B,D,D,B,D,D,B,A,B,D,B,C,D,A,C,C,A,A,C,B,A,D,C,C"]
    ];
    
    sheet.getRange(2, 1, answerData.length, 2).setValues(answerData);
    
    // Format the sheet
    var headerRange = sheet.getRange(1, 1, 1, 2);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f0f0f0");
    
    sheet.autoResizeColumns(1, 2);
  }
  
  return sheet;
}

// Test function to verify the setup
function testQuizSubmission() {
  var testData = {
    quizName: "Test1",
    name: "Test Student",
    email: "test@example.com",
    phone: "1234567890",
    subject: "English",
    attempted: 30,
    unattempted: 0,
    score: 25,
    timeTaken: "25.30",
    answers: ["C","B","A","D","B","A","C","B","C","D","A","C","C","A","D","B","A","D","C","D","A","C","D","A","B","D","B","D","A","B"]
  };
  
  var mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  var result = doPost(mockEvent);
  console.log("Test result:", result.getContent());
}

// Function to setup the entire system (run this once)
function setupQuizSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create AnswerKeys sheet
  createAnswerKeysSheet();
  
  // Create Test1 and Test2 sheets if they don't exist
  ["Test1", "Test2"].forEach(function(testName) {
    var sheet = ss.getSheetByName(testName);
    if (!sheet) {
      sheet = ss.insertSheet(testName);
      var headers = [
        "Timestamp", "Name", "Email", "Phone", "Subject", 
        "Attempted", "Unattempted", "Score", "Time Taken",
        "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10",
        "Q11", "Q12", "Q13", "Q14", "Q15", "Q16", "Q17", "Q18", "Q19", "Q20",
        "Q21", "Q22", "Q23", "Q24", "Q25", "Q26", "Q27", "Q28", "Q29", "Q30"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#f0f0f0");
      headerRange.setBorder(true, true, true, true, true, true);
    }
  });
  
  console.log("Quiz system setup complete!");
}