import crypto from "crypto";
import createError from 'http-errors';

export function verifySignatureGitHub(req, res, next) {
  const signature = req.headers["x-hub-signature-256"];
  const payload = JSON.stringify(req.body);

  if (!signature) {
    next(createError(401, "Отсутствует подпись"));
    return;
  }

  const hmac = crypto.createHmac(
    "sha256",
    process.env.GITHUB_WEBHOOK_SECRET
  );
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    next();
  } else {
    next(createError(403, "Недействительная подпись"));
  }
}

export function verifyAccessToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    next(createError(401, "Требуется авторизация"));
    return;
  } else if (token !== process.env.ACCESS_TOKEN_SECRET) {
    next(createError(401, "Токен недействителен"));
    return;
  } else {
    next();
  }
}
