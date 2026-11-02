import pino from "pino";
import { env } from "../env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  // Kata sandi dan token tidak boleh pernah masuk log.
  redact: {
    paths: ["req.headers.authorization", "password", "*.password", "token", "*.token"],
    censor: "[disensor]",
  },
});