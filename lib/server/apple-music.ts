import { createPrivateKey, sign } from "node:crypto";

type AppleConfig = { keyId: string; teamId: string; privateKey: string };

function config(): AppleConfig | null {
  const keyId = process.env.APPLE_MUSIC_KEY_ID?.trim();
  const teamId = process.env.APPLE_MUSIC_TEAM_ID?.trim();
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return keyId && teamId && privateKey ? { keyId, teamId, privateKey } : null;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

/** A short-lived MusicKit developer token. Never send the private key to the browser. */
export function createAppleMusicDeveloperToken() {
  const value = config();
  if (!value) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: value.keyId, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: value.teamId, iat: now, exp: now + 60 * 60 }));
  const signed = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signed), { key: createPrivateKey(value.privateKey), dsaEncoding: "ieee-p1363" });
  return `${signed}.${base64Url(signature)}`;
}

export function hasAppleMusicConfiguration() {
  return config() !== null;
}
