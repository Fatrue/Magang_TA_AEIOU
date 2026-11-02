import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { UserRole } from "../contract.js";

export interface TokenPayload {
  sub: number;
  name: string;
  role: UserRole;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): TokenPayload {
  // `algorithms` wajib disebut. Tanpa itu, token ber-algoritma "none"
  // bisa diterima dan siapa pun dapat mengaku sebagai admin.
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded === "string") throw new Error("Token tidak sah");
  return decoded as unknown as TokenPayload;
}
