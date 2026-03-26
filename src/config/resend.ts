import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠️  RESEND_API_KEY is not set — email sending will fail");
}

export const resend = new Resend(apiKey);

export const EMAIL_FROM = process.env.EMAIL_FROM || "Repose Music <noreply@reposemusic.app>";
export const APP_URL = process.env.APP_URL || "http://localhost:3000";
