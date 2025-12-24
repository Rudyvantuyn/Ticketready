import { setProCookie } from "../../lib/cookies";

function normalizeKey(k) {
  return String(k || "").trim().toUpperCase();
}

function isValidFormat(k) {
  // TR-XXXX-XXXX-XXXX (letters/digits)
  return /^TR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { licenseKey } = req.body || {};
    const key = normalizeKey(licenseKey);

    if (!isValidFormat(key)) {
      res.status(400).json({ error: "Invalid license key format." });
      return;
    }

    const allow = (process.env.LICENSE_KEYS || "")
      .split(",")
      .map((x) => normalizeKey(x))
      .filter(Boolean);

    if (!allow.length) {
      res.status(500).json({ error: "Server is not configured with LICENSE_KEYS." });
      return;
    }

    if (!allow.includes(key)) {
      res.status(401).json({ error: "License key not recognized." });
      return;
    }

    setProCookie(res);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e?.message || String(e) });
  }
}
