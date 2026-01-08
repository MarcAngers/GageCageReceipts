# GageCageReceipts

**GageCageReceipts** is a web-based receipt management application designed to streamline the process of tracking and organizing grocery receipts and utility payments between roommates in our home (basically homemade Splitwise). The application uses an online OCR API to read receipts and integrates with Google Apps Script, facilitating connection with Google Sheets for data storage and management.
There is a Flask server setup for local development and debugging.

## 🚀 Features

* **Web Interface**: User-friendly frontend for submitting receipt details.
* **Google Integration**: Seamless connection with Google Sheets/Drive via Apps Script.
* **Google Sheets Backend**: Receipt data is stored and managed through a shared Google Sheet that everyone in the house can edit.
* **Python/Flask Server Setup for a Local Deployment**: Lightweight server setup for local development and troubleshooting.

## 📂 Project Structure

* **`google_apps_script.js`**: JavaScript code designed to be hosted on Google Apps Script, enabling interaction with Google Sheets.
* **`templates/`**: Contains HTML templates for the web interface.
* **`static/`**: Hosts static assets such as CSS files, JavaScript, and images.
* **`images/`**: Directory for storing project assets or uploaded receipt images.
* **`app.py`**: The Flask application logic for local deployment.

## ⚙️ Cloud Deployment

### 1. Clone the Repository
```bash
git clone [https://github.com/MarcAngers/GageCageReceipts.git](https://github.com/MarcAngers/GageCageReceipts.git)
cd GageCageReceipts
```

### 2. Setup Google Sheet
1. Create a new Google Sheet
2. Go to https://docs.google.com/spreadsheets/d/1FD-jWAkq4_Bz9g6L5EzygkOfGZ02Un1AdxbCW_PTVUM/edit?usp=sharing
3. Copy the following tabs to your own version:
   - Running Totals
   - Boilerplate
   - Calculator
   - Credit Cards
   - E-Transfers
   - Dictionary
4. **Optionally**: Copy the tabs for Utilities and Rent

### 3. Configure Google Apps Script
1.  Go to Extentions > Apps Script
3.  Copy the contents of `google_apps_script.js` from this repository and paste it into the editor.
4.  Save and Deploy the script as a **Web App**.
5.  Copy the URL for your Web App

### 4. Link your code to the Web App
Paste your Web App URL to line 411 of script.js

### 5. Host your static webpage
Put your frontend code on the internet somewhere for easy access. This page should not be linked with your Google App and ready to update your sheet.

## ⚙️ Local Installation & Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/MarcAngers/GageCageReceipts.git](https://github.com/MarcAngers/GageCageReceipts.git)
cd GageCageReceipts
```

### 2. Set Up Virtual Environment (Optional but Recommended)
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies
*Note: Ensure you have Flask installed. If you have a requirements.txt, use that instead.*
```bash
pip install flask requests
```

### 4. Configure Google Apps Script
1.  Go to [Google Apps Script](https://script.google.com/).
2.  Create a new project.
3.  Copy the contents of `google_apps_script.js` from this repository and paste it into the editor.
4.  Save and Deploy the script as a **Web App**.
5.  *Update `app.py` (or your environment variables) with your specific Google Script URL.*

### 5. Run the Application
```bash
python app.py
```
The application should now be running locally, typically accessible at `http://127.0.0.1:5000`.

## 📝 Usage

1.  Navigate to your webpage (either locally or on the internet).
2.  Use the interface to upload receipt images or manually enter receipt data.
3.  Validate the data, the OCR and processing often make mistakes, so make sure everything is correct before you send!
4.  Submit the form to sync data with the backend Google Sheet.
