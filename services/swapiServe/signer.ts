import crypto from "node:crypto";

/**
 * Builds the comlink auth headers for a request.
 *
 * Ported from signPostRequest in @swgoh-utils/comlink (index.js:5-21) rather than imported,
 * because the service proxies raw bytes and never instantiates ComlinkStub. The signature covers
 * timestamp + method + uri + md5(body), and notably NOT the host, which is what allows a signed
 * request to be forwarded to any backend.
 *
 * The library hashes JSON.stringify(body); we hash the raw bytes we received, which are the same
 * bytes the client stringified. Re-serialising here would change them and invalidate the hash.
 *
 * Returns an empty object when credentials are absent, matching the library's opt-out.
 */
export function signRequest({
    accessKey,
    secretKey,
    method,
    uri,
    body,
}: {
    accessKey: string;
    secretKey: string;
    method: string;
    uri: string;
    body: Buffer | null;
}): Record<string, string> {
    if (!accessKey || !secretKey) return {};

    const reqTime = `${Date.now()}`;
    const hmac = crypto.createHmac("sha256", secretKey);

    hmac.update(reqTime);
    hmac.update(method);
    hmac.update(uri);

    const hash = crypto.createHash("md5");
    hash.update(body ?? "");
    hmac.update(hash.digest("hex"));

    return {
        "X-Date": reqTime,
        Authorization: `HMAC-SHA256 Credential=${accessKey},Signature=${hmac.digest("hex")}`,
    };
}
