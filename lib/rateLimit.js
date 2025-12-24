// Server-side daily limit (3/day in Free).
// Recommended: Upstash Redis REST (works great on Vercel).
// If not configured, we fall back to in-memory (resets on redeploy / serverless cold start).

const FREE_LIMIT_PER_DAY = 3;
const mem = new Map(); // key -> count (fallback only)

function getTodayKey(trId) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `tr:count:${trId}:${yyyy}-${mm}-${dd}`;
}

async function upstashFetch(path, bodyObj) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });

  if (!res.ok) {
    // If Upstash misconfigured, fall back
    return null;
  }
  return res.json();
}

async function upstashGet(key) {
  const data = await upstashFetch(`/get/${encodeURIComponent(key)}`);
  if (!data || typeof data.result === "undefined") return null;
  return data.result;
}

async function upstashIncr(key) {
  const data = await upstashFetch(`/incr/${encodeURIComponent(key)}`);
  if (!data || typeof data.result === "undefined") return null;
  return data.result;
}

async function upstashExpire(key, seconds) {
  await upstashFetch(`/expire/${encodeURIComponent(key)}/${seconds}`);
}

export async function getFreeUsageStatus(trId) {
  const key = getTodayKey(trId);

  // Try Upstash first
  const current = await upstashGet(key);
  if (current !== null) {
    const used = Number(current) || 0;
    return {
      storage: "upstash",
      used,
      remaining: Math.max(0, FREE_LIMIT_PER_DAY - used),
      limit: FREE_LIMIT_PER_DAY
    };
  }

  // Fallback in-memory
  const used = mem.get(key) || 0;
  return {
    storage: "memory",
    used,
    remaining: Math.max(0, FREE_LIMIT_PER_DAY - used),
    limit: FREE_LIMIT_PER_DAY
  };
}

export async function consumeFreeGeneration(trId) {
  const key = getTodayKey(trId);

  // Upstash path
  const next = await upstashIncr(key);
  if (next !== null) {
    // expire after ~2 days
    await upstashExpire(key, 60 * 60 * 48);
    const used = Number(next) || 0;
    return {
      storage: "upstash",
      used,
      remaining: Math.max(0, FREE_LIMIT_PER_DAY - used),
      limit: FREE_LIMIT_PER_DAY
    };
  }

  // Memory fallback
  const used = (mem.get(key) || 0) + 1;
  mem.set(key, used);
  return {
    storage: "memory",
    used,
    remaining: Math.max(0, FREE_LIMIT_PER_DAY - used),
    limit: FREE_LIMIT_PER_DAY
  };
}

export function isFreeLimitReached(used) {
  return used >= FREE_LIMIT_PER_DAY;
}
