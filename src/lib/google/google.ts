import { google, sheets_v4 } from "googleapis";
import { getGoogleAuth } from "./auth";

let sheetsClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    const auth = getGoogleAuth();
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set");
  return id;
}
