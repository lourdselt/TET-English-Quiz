# TET Quiz System - Complete Setup Guide

## Overview
This system manages multiple TET quizzes with separate Google Sheets tracking, automatic answer validation, and color-coded results.

## File Structure

### Quiz Files
- **index.html** → **Test1** (Original quiz with owls/mice passage)
- **quiz_2.html** → **Test2** (New quiz with Plato/Socrates passage)

### Supporting Files
- **google_apps_script_updated.gs** - Updated Apps Script with universal handling
- **lourds_logo_base64.txt** - Logo for watermarks
- **Lourds_logo.png** - Logo image file

## Key Features Implemented

### ✅ Modifications Completed:

1. **Separate Test Sheets**
   - Test1 → Creates "Test1" sheet in Google Sheets
   - Test2 → Creates "Test2" sheet in Google Sheets
   - Future tests will create "Test3", "Test4", etc.

2. **Option Code System**
   - Answers stored as A, B, C, D (instead of full text)
   - Google Sheets shows option codes with color coding:
     - **Green** = Correct answers
     - **Red** = Incorrect answers
     - **Black** = Unanswered

3. **Enhanced Quiz Features**
   - Real-time answered/unanswered count below question grid
   - Toggle mark/unmark functionality (fixed permanent marking issue)
   - Mobile-responsive design (fixed Q1/Q17 text wrapping)
   - Time format changed to minutes (e.g., "12.30" instead of "750 seconds")

4. **Universal Google Apps Script**
   - Automatically creates sheets for new tests
   - Handles both hardcoded and AnswerKeys sheet lookup
   - Color codes option codes (Green/Red) with background highlighting
   - Robust quiz name matching (case-insensitive, space-tolerant)

## Answer Keys

### Test1 (index.html) - Option Codes:
```
C,B,A,D,B,A,C,B,C,D,A,C,C,A,D,B,A,D,C,D,A,C,D,A,B,D,B,D,A,B
```

### Test2 (quiz_2.html) - Option Codes:
```
C,B,D,D,C,C,B,D,D,B,D,D,B,A,B,D,B,C,D,A,C,C,A,A,C,B,A,D,C,C
```

## Google Apps Script Setup

### 1. Deploy the Script
1. Copy `google_apps_script_updated.gs` to Google Apps Script
2. Deploy as Web App with "Execute as: Me" and "Who has access: Anyone"
3. Copy the Web App URL

### 2. Update Quiz URLs
Replace the fetch URLs in both quiz files:
```javascript
fetch("YOUR_WEB_APP_URL_HERE", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
})
```

### 3. Optional: Create AnswerKeys Sheet
Run `setupQuizSystem()` function once to create:
- AnswerKeys sheet with centralized answer keys
- Pre-formatted Test1 and Test2 sheets
- Proper headers and styling

## Google Sheets Structure

Each test creates a separate sheet with columns:
1. **Metadata** (Columns A-I): Timestamp, Name, Email, Phone, Subject, Attempted, Unattempted, Score, Time Taken
2. **Answers** (Columns J-AM): Q1-Q30 with option codes (A/B/C/D)
3. **Color Coding**: Green for correct, Red for incorrect, Black for unanswered

## Quiz Flow

### Student Experience:
1. Enter candidate details (Name, Email, Phone, Subject)
2. Answer 30 questions with 30-minute timer
3. See real-time answered/unanswered count
4. Mark/unmark questions for review
5. Submit and view detailed results
6. Download PDF report with watermark

### Admin Experience:
1. View organized data in separate sheets per test
2. Color-coded answers for quick assessment
3. Complete candidate information and performance metrics
4. Option codes for easy analysis and pattern recognition

## Mobile Compatibility
- Responsive design works on all screen sizes
- Fixed text wrapping issues in complex questions
- Touch-friendly interface for mobile devices

## Security Features
- Input validation and sanitization
- Error handling for malformed requests
- Fallback mechanisms for missing data
- CORS handling for cross-domain requests

## Future Enhancements
- Easy to add Test3, Test4, etc. by:
  1. Creating new HTML file with "Test3" identifier
  2. Adding answer key to hardcoded map or AnswerKeys sheet
  3. Script automatically creates new sheets and handles data

## Testing
Use the `testQuizSubmission()` function in Apps Script to verify setup before going live.

---

**System is ready for production use!**