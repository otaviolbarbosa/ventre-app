const { config } = require("dotenv");
const { resolve } = require("node:path");
const { execSync } = require("node:child_process");

config({ path: resolve(__dirname, "../../../apps/web/.env.local") });

execSync(`cross-var ${process.argv.slice(2).join(" ")}`, {
  stdio: "inherit",
  env: process.env,
});
