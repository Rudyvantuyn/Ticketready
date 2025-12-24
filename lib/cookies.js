import crypto from "crypto";

const ID_COOKIE = "tr_id";
const PRO_COOKIE = "tr_pro"; // signed
const PRO_TTL_DAYS = 30;

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (typeof opts.maxAge === "number") parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  return parts.join("; ");
}

function hmac(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function getOrSetVisitorId(req, res) {
  const cookies = parseCookies(req);
  let id = cookies[ID_COOKIE];

  if (!id || id.length < 8) {
    id = crypto.randomUUID();
    const secure = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      serializeCookie(ID_COOKIE, id, {
        httpOnly: true,
        secure,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      })
    );
  }

  return id;
}

export function isPro(req) {
  const cookies = parseCookies(req);
  const token = cookies[PRO_COOKIE];
  if (!token) return false;

  const secret = process.env.COOKIE_SECRET || "";
  if (!secret) return false;

  // token format: "1.<exp>.<sig>"
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [flag, expStr, sig] = parts;

  if (flag !== "1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = hmac(`${flag}.${expStr}`, secret);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function setProCookie(res) {
  const secret = process.env.COOKIE_SECRET || "";
  if (!secret) {
    throw new Error("COOKIE_SECRET is not set.");
  }

  const exp = Date.now() + PRO_TTL_DAYS * 24 * 60 * 60 * 1000;
  const expStr = String(exp);
  const flag = "1";
  const sig = hmac(`${flag}.${expStr}`, secret);
  const token = `${flag}.${expStr}.${sig}`;

  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    serializeCookie(PRO_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      expires: new Date(exp)
    })
  );
}

export function clearProCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    serializeCookie(PRO_COOKIE, "", {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      expires: new Date(0)
    })
  );
}
