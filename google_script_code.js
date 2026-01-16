/* 
 * -------------------------------------------------------------------------
 * V6: FIX "NaN" HOURS - PROPER DATE PARSING
 * -------------------------------------------------------------------------
 */

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
        var rawData = e.postData.contents;
        var data = JSON.parse(rawData);

        // --- MODE 1: Fetch History ---
        if (data.action === 'getHistory') {
            var lastRow = sheet.getLastRow();
            var logs = [];
            if (lastRow >= 2) {
                // Performance: Read all data to filter accurately
                // Assuming < 5000 rows for now, this is fast.
                var range = sheet.getRange(2, 1, lastRow - 1, 4);
                var values = range.getDisplayValues(); // Get strings "1/16/2026"

                var reqMonth = data.month; // 0-11
                var reqYear = data.year;   // 2026

                logs = values.filter(function (row) {
                    // Parse Date "1/16/2026"
                    var dateParts = row[0].split('/');
                    if (dateParts.length !== 3) return false;

                    var rMonth = parseInt(dateParts[0], 10) - 1; // 1 -> 0
                    var rYear = parseInt(dateParts[2], 10);

                    // If filter params exist, match them. Else return true (or limit to last 50).
                    if (reqMonth !== undefined && reqYear !== undefined) {
                        return rMonth === reqMonth && rYear === reqYear;
                    }
                    return true;
                }).map(function (row) {
                    return {
                        dateStr: row[0],
                        checkIn: row[1],
                        checkOut: row[2],
                        duration: row[3]
                    };
                }); // No reverse yet, we want chronological for the table usually? Or reverse?
                // User asked for a list for the month. Usually Table is Top->Down (1st to 30th).
                // Let's keep it chronological for the table view.

                // If no filter was provided (default load), take last 50 and reverse
                if (reqMonth === undefined) {
                    logs = logs.slice(-50).reverse();
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success", history: logs }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // --- MODE 2: Log Time ---
        var targetDateStr = data.dateStr; // "1/15/2026"
        var lastRow = sheet.getLastRow();
        var rowIndex = -1;

        if (lastRow >= 2) {
            // Find row by matching Date string in Col A
            var startRow = Math.max(2, lastRow - 50);
            var displayValues = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues();
            for (var i = displayValues.length - 1; i >= 0; i--) {
                if (displayValues[i][0] === targetDateStr) {
                    rowIndex = startRow + i;
                    break;
                }
            }
        }

        if (data.action === 'checkin') {
            if (rowIndex !== -1) {
                var currentCheckIn = sheet.getRange(rowIndex, 2).getValue();
                if (currentCheckIn !== "") {
                    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Already checked in." }))
                        .setMimeType(ContentService.MimeType.JSON);
                } else {
                    sheet.getRange(rowIndex, 2).setValue(data.timeStr);
                }
            } else {
                sheet.appendRow([targetDateStr, data.timeStr, "", "", data.deviceInfo]);
            }
        }
        else if (data.action === 'checkout') {
            if (rowIndex === -1) {
                return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "No Check-In found for today." }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            // Update Checkout
            sheet.getRange(rowIndex, 3).setValue(data.timeStr);

            // --- DURATION CALCULATION FIX ---
            // Problem: format is "12:38:38 AM". new Date("1/1/2000 12:38:38 AM") is tricky.
            // We will parse it manually to be 100% sure.

            var checkInVal = sheet.getRange(rowIndex, 2).getDisplayValue(); // Force String "12:38:38 AM"
            var checkOutVal = data.timeStr; // "12:40:58 AM"

            var durationStr = "Error";

            // Use helper to parse properly
            var t1 = parseTimeStrict(checkInVal);
            var t2 = parseTimeStrict(checkOutVal);

            if (t1 && t2) {
                var diffMs = t2 - t1;
                // Handle next day crossing (e.g. 11 PM to 1 AM)
                if (diffMs < 0) {
                    diffMs += 24 * 60 * 60 * 1000;
                }

                // Decimal Calculation (e.g. 2.5)
                // Round to 2 decimal places
                var totalHours = diffMs / 3600000;
                durationStr = Math.round(totalHours * 100) / 100;
            }

            // --- SHEET WRITE: FORMULA ---
            // Formula: =(C{row}-B{row} + (C{row}<B{row})) * 24
            var formula = '=(C' + rowIndex + '-B' + rowIndex + '+(C' + rowIndex + '<B' + rowIndex + '))*24';

            var cell = sheet.getRange(rowIndex, 4);
            cell.setFormula(formula);
            cell.setNumberFormat("0.00"); // Ensure it looks like "2.50"

            // Return the duration so the UI can update immediately
            return ContentService.createTextOutput(JSON.stringify({
                "status": "success",
                "duration": durationStr
            })).setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// Parses "12:38:38 AM", "8:00 PM", "9:30:15 AM" strictly
function parseTimeStrict(timeStr) {
    if (!timeStr) return null;

    // Normalize string
    var s = timeStr.trim().toUpperCase(); // "12:38:38 AM"

    // Regex to capture HH, MM, SS, AM/PM
    var re = /(\d+):(\d+)(?::(\d+))?\s*(AM|PM)/;
    var match = s.match(re);

    if (!match) return null;

    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    var seconds = match[3] ? parseInt(match[3], 10) : 0;
    var ampm = match[4];

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    var d = new Date();
    d.setHours(hours, minutes, seconds, 0);
    return d;
}
