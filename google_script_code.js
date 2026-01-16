/* 
 * -------------------------------------------------------------------------
 * V3: ONE ROW PER DAY - UPDATE Google Script Code
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
                var startRow = Math.max(2, lastRow - 50); // Last 50 days
                var numRows = lastRow - startRow + 1;
                var range = sheet.getRange(startRow, 1, numRows, 4); // A to D
                var values = range.getValues();

                logs = values.map(function (row) {
                    return {
                        dateStr: formatDate(row[0]), // Col A
                        checkIn: formatTime(row[1]), // Col B
                        checkOut: formatTime(row[2]),// Col C
                        duration: row[3]             // Col D
                    };
                }).reverse();
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success", history: logs }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // --- MODE 2: Log Time (Row Merge Logic) ---
        var todayStr = data.date; // "Jan 15, 2026"
        var lastRow = sheet.getLastRow();
        var rowIndex = -1;

        // Search for today's row (Optimized: search from bottom up)
        if (lastRow >= 2) {
            // Get all dates in Column A
            // Note: In a huge sheet this is slow, but for <1000 rows it's fine. 
            // For speed, we just look at the last 30 rows.
            var searchStart = Math.max(2, lastRow - 30);
            var dates = sheet.getRange(searchStart, 1, lastRow - searchStart + 1, 1).getValues();

            for (var i = dates.length - 1; i >= 0; i--) {
                var rowDate = formatDate(dates[i][0]);
                if (rowDate === todayStr) {
                    rowIndex = searchStart + i;
                    break;
                }
            }
        }

        if (data.action === 'checkin') {
            if (rowIndex !== -1) {
                // Already Checked In for this date
                // Check if Col B (CheckIn) is empty? Unlikely if row exists.
                var checkInVal = sheet.getRange(rowIndex, 2).getValue();
                if (checkInVal !== "") {
                    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Already checked in today!" }))
                        .setMimeType(ContentService.MimeType.JSON);
                } else {
                    // Case: Row exists but no checkin? Maybe manually added. Update it.
                    sheet.getRange(rowIndex, 2).setValue(data.time);
                }
            } else {
                // Create New Row
                // A:Date, B:CheckIn, C:CheckOut, D:Hours, E:Info
                sheet.appendRow([todayStr, data.time, "", "", data.deviceInfo]);
            }
        }

        else if (data.action === 'checkout') {
            if (rowIndex === -1) {
                return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "You haven't checked in today yet!" }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            var rowRange = sheet.getRange(rowIndex, 1, 1, 3); // A, B, C
            var rowVals = rowRange.getValues()[0];
            var storedCheckOut = rowVals[2];

            if (storedCheckOut !== "") {
                return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Already checked out today!" }))
                    .setMimeType(ContentService.MimeType.JSON);
            }

            // Update Checkout
            sheet.getRange(rowIndex, 3).setValue(data.time);

            // Calculate Duration
            // CheckIn time is in B (index 1). It might be a string "8:00 AM".
            // Parsing "8:00 AM" in AppsScript is tricky depending on Locale settings.
            // We rely on the client sent 'checkinTime' ISO from localStorage if possible, 
            // but here we must rely on what's in the sheet or compute simply.

            // SIMPLE CALCULATION:
            // We will let the Sheet Formula handle it OR do basic string math.
            // Better approach: Client sends the calculation? No, insecure.
            // We will write the string. User can put a formula in Col D if they want, 
            // OR we calculate if we can parse.

            // Let's write the raw time string. Then try to calc diff if possible.
            // Converting "1:30 PM" to minutes is tedious without Moment.js.
            // We will just write the value.

            // OPTIONAL: We can try to set a formula in Col D
            // =C_Row - B_Row
            sheet.getRange(rowIndex, 4).setFormulaR1C1('=R[0]C[-1]-R[0]C[-2]');
            // Format Col D as Duration
            sheet.getRange(rowIndex, 4).setNumberFormat("[h]:mm");
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

// Helpers
function formatDate(d) {
    // Handle Date Object or String
    if (!d) return "";
    if (typeof d === 'string') return d;
    // If it's a Google Script Date object
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMM d, yyyy");
}

function formatTime(t) {
    if (!t) return "";
    if (typeof t === 'string') return t;
    return Utilities.formatDate(t, Session.getScriptTimeZone(), "h:mm a");
}
