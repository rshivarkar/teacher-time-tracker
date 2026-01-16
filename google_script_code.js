/* 
 * -------------------------------------------------------------------------
 * UPDATED CODE (V2) - COPY THIS ENTIRE FILE
 * -------------------------------------------------------------------------
 */

function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000); // Prevent concurrent writing issues

    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
        var rawData = e.postData.contents;
        var data = JSON.parse(rawData);

        // --- MODE 1: Fetch History ---
        if (data.action === 'getHistory') {
            var lastRow = sheet.getLastRow();
            var logs = [];

            // Only read if there is data (Row 1 is headers, data starts Row 2)
            if (lastRow >= 2) {
                // Perform efficient read: Get columns A (Time) through C (Date)
                // We assume: Col A=Timestamp, Col B=Action, Col C=DateStr, Col D=TimeStr
                // Fetching last 100 rows to find history
                var startRow = Math.max(2, lastRow - 100);
                var numRows = lastRow - startRow + 1;
                var range = sheet.getRange(startRow, 1, numRows, 4);
                var values = range.getValues();

                // Convert to clean JSON
                logs = values.map(function (row) {
                    return {
                        timestamp: row[0],
                        action: row[1],
                        dateStr: row[2], // The string date "Jan 15, 2026"
                        timeStr: row[3]  // The string time "8:00 AM"
                    };
                }).reverse(); // Newest first
            }

            return ContentService.createTextOutput(JSON.stringify({
                status: "success",
                history: logs
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- MODE 2: Log Check-in/Out ---
        sheet.appendRow([
            new Date(),       // A: System Timestamp
            data.action,      // B: Check In or Out
            data.date,        // C: Date string
            data.time,        // D: Time string
            data.deviceInfo   // E: Info
        ]);

        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
