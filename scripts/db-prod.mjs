import "dotenv/config";
import { execSync } from "node:child_process";

const prodUrl = process.env.DATABASE_URL_PROD;
if (!prodUrl) {
  console.error("DATABASE_URL_PROD is not set in .env");
  process.exit(1);
}

// The app and Prisma CLI read DATABASE_URL; point it at prod for this command.
process.env.DATABASE_URL = prodUrl;

const command = process.argv.slice(2).join(" ");
if (!command) {
  console.error("Usage: node scripts/db-prod.mjs <prisma command...>");
  process.exit(1);
}

try {
  execSync(command, { stdio: "inherit", env: process.env });
} catch (err) {
  process.exit(typeof err.status === "number" ? err.status : 1);
}
