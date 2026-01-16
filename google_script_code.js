/* 
 * -------------------------------------------------------------------------
 * COPY THIS ENTIRE FILE
 * -------------------------------------------------------------------------
 * 1. Go to your Google Sheet: 
 *    https://docs.google.com/spreadsheets/d/1j_FHdLKc4vswfT6i5IGor_b-W5m9u2BDo45aTlaxyCQ/edit
 * 2. Click "Extensions" (top menu) -> "Apps Script"
 * 3. Delete any code there, and PASTE this code in.
 * 4. Click the blue "Deploy" button (top right) -> "New deployment"
 * 5. Select type: "Web app"
 * 6. Set "Who has access" to "Anyone" (Critical!)
 * 7. Click "Deploy" and copy the "Web app URL"
 * -------------------------------------------------------------------------
 */

function doPost(e) {
    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

        // Parse the data sent from the nice button app
        var data = JSON.parse(e.postData.contents);

        // Append the row: Timestamp | Action | Date | Time | Device
        sheet.appendRow([
            new Date(),       // A: System Timestamp
            data.action,      // B: Check In or Out
            data.date,        // C: Date
            data.time,        // D: Time
            data.deviceInfo   // E: Info about the phone/laptop
        ]);

        // Return a success message
        return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

function doGet(e) {
    return ContentService.createTextOutput("Hello! The Staff Tracker backend is running. Use the buttons to send data.");
}
