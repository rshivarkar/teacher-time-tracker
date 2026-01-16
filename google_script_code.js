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
                var startRow = Math.max(2, lastRow - 50);
                var numRows = lastRow - startRow + 1;
                var range = sheet.getRange(startRow, 1, numRows, 4);
                // USE getDisplayValues to get "1/16/2026" instead of raw Date objects
                var values = range.getDisplayValues();

                logs = values.map(function (row) {
                    return {
                        dateStr: row[0], // Now "1/16/2026"
                        checkIn: row[1], // "1:07:47 AM"
                        checkOut: row[2], // "1:10:53 AM"
                        duration: row[3] // "0.05"
                    };
                }).reverse();
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

            sheet.getRange(rowIndex, 4).setValue(durationStr);

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
