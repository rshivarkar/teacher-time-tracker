/* 
 * -------------------------------------------------------------------------
 * V5: ROBUST "ONE ROW PER DAY" - Google Script Code
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
                var startRow = Math.max(2, lastRow - 50); // Last 50 entries
                var numRows = lastRow - startRow + 1;
                var range = sheet.getRange(startRow, 1, numRows, 4); // A, B, C, D
                var values = range.getValues();

                logs = values.map(function (row) {
                    return {
                        dateStr: String(row[0]), // Col A
                        checkIn: String(row[1]), // Col B
                        checkOut: String(row[2]),// Col C
                        duration: String(row[3]) // Col D
                    };
                }).reverse();
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success", history: logs }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // --- MODE 2: Log Check In/Out with STRICT Date Matching ---

        // 1. Construct the Search Key.
        // The client sends year/month/day. We will use that to match.
        // If not present (older client), fallback to data.dateStr
        var targetDateStr = data.dateStr; // "1/15/2026" usually

        // 2. Find the row
        var lastRow = sheet.getLastRow();
        var rowIndex = -1;

        if (lastRow >= 2) {
            // Robust Search: Iterate backwards
            // We read Column A as Strings to match what we write
            // Note: getDisplayValues is slower but safer for date matching
            var startRow = Math.max(2, lastRow - 50);
            var displayValues = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues();

            for (var i = displayValues.length - 1; i >= 0; i--) {
                // Match exactly the string representation "1/15/2026"
                if (displayValues[i][0] === targetDateStr) {
                    rowIndex = startRow + i;
                    break;
                }
            }
        }

        // 3. Execution Logic
        if (data.action === 'checkin') {
            if (rowIndex !== -1) {
                // Found existing row for today.
                // Check if CheckIn (Col B) is empty?
                var currentCheckIn = sheet.getRange(rowIndex, 2).getValue();
                if (currentCheckIn !== "") {
                    // ALREADY CHECKED IN
                    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Already checked in, ignoring duplicate." }))
                        .setMimeType(ContentService.MimeType.JSON);
                } else {
                    // Update CheckIn
                    sheet.getRange(rowIndex, 2).setValue(data.timeStr);
                }
            } else {
                // Create NEW Row
                sheet.appendRow([
                    targetDateStr,   // A: "1/16/2026"
                    data.timeStr,    // B: "8:00 AM"
                    "",              // C: Checkout empty
                    "",              // D: Hours empty
                    data.deviceInfo  // E
                ]);
            }
        }
        else if (data.action === 'checkout') {
            if (rowIndex === -1) {
                // No checkin found for today. Cannot checkout.
                return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "No Check-In found for today." }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            // Update Checkout (Col C)
            sheet.getRange(rowIndex, 3).setValue(data.timeStr);

            // Calculate Duration (Col D)
            // We will perform a time diff calculation here in the script for accuracy
            var checkInCell = sheet.getRange(rowIndex, 2).getValue(); // "8:00 AM" string or Date
            var checkOutStr = data.timeStr;

            // Helper to parse "8:00 AM"
            var durationStr = calculateDuration(checkInCell, checkOutStr);
            sheet.getRange(rowIndex, 4).setValue(durationStr);
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

function calculateDuration(inVal, outStr) {
    try {
        // Create dummy dates for today
        var d1 = new Date();
        var d2 = new Date();

        // Parse "10:00:00 AM" or similar
        var t1 = parseTime(inVal);
        var t2 = parseTime(outStr);

        if (!t1 || !t2) return "Error";

        var diffMs = t2 - t1;
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle midnight crossing if needed

        var diffHrs = Math.floor(diffMs / 3600000);
        var diffMins = Math.floor((diffMs % 3600000) / 60000);

        return diffHrs + " hrs " + diffMins + " min";
    } catch (e) {
        return "Calc Error";
    }
}

function parseTime(t) {
    if (t instanceof Date) return t; // Already a date object from sheet?
    if (!t) return null;

    // Parse "8:00:00 AM" or "8:00 AM"
    // Apps Script default new Date() parser is decent
    return new Date("1/1/2000 " + t);
}
