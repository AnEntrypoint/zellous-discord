import { redactText, redactValue } from "./redaction.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ranks: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  constructor(private readonly level: LogLevel, private readonly sink: (line: string) => void = (line) => process.stdout.write(line + String.fromCharCode(10))) {}

  log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    if (ranks[level] < ranks[this.level]) return;
    const record = {
      time: new Date().toISOString(),
      level,
      message: redactText(message),
      meta: redactValue(meta)
    };
    this.sink(JSON.stringify(record));
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.log("error", message, meta);
  }
}