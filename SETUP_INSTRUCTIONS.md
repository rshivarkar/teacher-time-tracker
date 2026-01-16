# How to Connect this App to Google Sheets

To make the data actually save to a Google Sheet, you need to copy a small script into your Google Sheet.

## Step 1: Create your Google Sheet
1. Go to `sheets.google.com` and create a blank new sheet.
2. Name it "Staff Time Logs" (or anything you like).
3. In the first row (Header), add these columns:
   - **A1**: Timestamp
   - **B1**: Action (Check In/Out)
   - **C1**: Date
   - **D1**: Time
   - **E1**: Device Info

## Step 2: Add the Script
1. In your Google Sheet, go to **Extensions** > **Apps Script**.
2. Delete any code currently in the editor (`myFunction`).
3. Copy and Paste the following code:

```javascript
/* 
 * Google Apps Script to Handle Staff Check-ins
 * attached to the Google Sheet.
 */

function doPost(e) {
  try {
    // 1. Get the data sent from the web app
    var data = JSON.parse(e.postData.contents);
    
    // 2. Open the spreadsheet and get the first sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // 3. Append the new row
    sheet.appendRow([
      new Date(),       // Server Timestamp
      data.action,      // 'checkin' or 'checkout'
      data.date,        // Client reported date
      data.time,        // Client reported time
      data.deviceInfo   // Browser info
    ]);
    
    // 4. Return Success
    return ContentService.createTextOutput(JSON.stringify({"result":"success"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Handle Errors
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": error}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Step 3: Deploy the Script
1. Click the blue **Deploy** button (top right) -> **New Deployment**.
2. Click the specific **Select type** gear icon -> **Web app**.
3. Fill in the form:
   - **Description**: "Time Tracker API"
   - **Execute as**: "Me" (your email)
   - **Who has access**: **"Anyone"** (This is critical so the external web app can save data without a login popup).
4. Click **Deploy**.
5. Copy the **Web App URL** (it ends in `/exec`).

## Step 4: Connect the Web App
1. Open the `script.js` file in this folder.
2. Find the line:
   ```javascript
   const SCRIPT_URL = 'REPLACE_ME_WITH_YOUR_SCRIPT_URL';
   ```
3. Paste your Web App URL there.

You're done! Open `index.html` in any browser to test.
