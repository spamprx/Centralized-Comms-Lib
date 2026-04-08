import { Request, Response, NextFunction } from "express";

const MAX_PAYLOAD_SIZE = 100 * 1024;
const MAX_DEPTH = 10;
const MAX_KEYS = 100;

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const NULL_BYTE_REGEX = /\x00/g;

const DANGEROUS_PATTERNS = [
    // Script injection
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    // Event handlers
    /on\w+\s*=/gi,
    // javascript: protocol
    /javascript\s*:/gi,
    // data: URI
    /data\s*:/gi,
];

/**
 * Headers that must not be sanitized
 */
const SKIP_HEADERS = new Set([
    "authorization",
    "cookie",
    "content-type",
    "content-length",
    "host",
    "connection",
    "transfer-encoding",
    "upgrade",
]);

function escapeHtml(value: string): string 
{
    return value
        .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;")
        .trim();
}

function stripNullBytes(value: string): string 
{
    return value.replace(NULL_BYTE_REGEX, "");
}

function containsDangerousPattern(value: string): boolean 
{
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));
}

function sanitizeValue(
    value: unknown,
    depth = 0,
    keyCount = { count: 0 },
): unknown 
{
    // Depth-bomb protection
    if (depth > MAX_DEPTH) 
    {
        throw new Error("Payload exceeds maximum nesting depth");
    }

    if (typeof value === "string") 
    {
        let sanitized = stripNullBytes(value);

        if (containsDangerousPattern(sanitized)) 
        {
            throw new Error("Potentially malicious content detected in payload");
        }

        return escapeHtml(sanitized);
    }

    if (Array.isArray(value)) 
    {
        return value.map((item) => sanitizeValue(item, depth + 1, keyCount));
    }

    if (value !== null && typeof value === "object") 
    {
        const sanitized: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) 
        {
            keyCount.count++;
            if (keyCount.count > MAX_KEYS) 
            {
                throw new Error("Payload exceeds maximum number of keys");
            }

            // Prototype pollution protection
            if (BLOCKED_KEYS.has(key)) continue;

            // Sanitize the key itself before using it
            const safeKey = escapeHtml(stripNullBytes(String(key)));
            sanitized[safeKey] = sanitizeValue(val, depth + 1, keyCount);
        }

        return sanitized;
    }

    return value;
}

function getPayloadSize(body: unknown): number 
{
    try 
    {
        return Buffer.byteLength(JSON.stringify(body), "utf8");
    } 
    catch 
    {
        return 0;
    }
}

const ALLOWED_CONTENT_TYPES = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
];

/** Returns true and sends 415 if the Content-Type is unsupported. */
function checkContentType(req: Request, res: Response): boolean
{
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return false;
    if (!req.body || Object.keys(req.body).length === 0) return false;

    const contentType = req.headers["content-type"] ?? "";
    const isAllowed = ALLOWED_CONTENT_TYPES.some((t) => contentType.includes(t));

    if (!isAllowed)
    {
        res.status(415).json({ error: "Unsupported Media Type" });
        return true;
    }

    return false;
}

/** Returns true and sends 413 if the body exceeds MAX_PAYLOAD_SIZE. */
function checkPayloadSize(req: Request, res: Response): boolean
{
    if (req.body && getPayloadSize(req.body) > MAX_PAYLOAD_SIZE)
    {
        res.status(413).json({ error: "Payload too large" });
        return true;
    }
    return false;
}

/** Sanitizes custom / forwarded request headers in-place. */
function sanitizeHeaders(req: Request): void
{
    for (const [k, v] of Object.entries(req.headers))
    {
        if (SKIP_HEADERS.has(k.toLowerCase())) continue;
        req.headers[k] = Array.isArray(v)
            ? v.map((s) => sanitizeValue(s) as string)
            : v !== undefined
            ? (sanitizeValue(v) as string)
            : undefined;
    }
}

// FUTURE: Check for further sanitization needs.

export const sanitize = (
    req: Request,
    res: Response,
    next: NextFunction,
): void =>
{
    try
    {
        if (checkContentType(req, res)) return;
        if (checkPayloadSize(req, res)) return;

        if (req.body   && typeof req.body   === "object") req.body   = sanitizeValue(req.body);
        if (req.query  && typeof req.query  === "object") req.query  = sanitizeValue(req.query)  as typeof req.query;
        if (req.params && typeof req.params === "object") req.params = sanitizeValue(req.params) as typeof req.params;

        sanitizeHeaders(req);

        next();
    }
    catch (err)
    {
        if (err instanceof Error)
        {
            res.status(400).json({ error: err.message });
            return;
        }
        next(err);
    }
};

export default sanitize;