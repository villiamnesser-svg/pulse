import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./pulse.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./pulse.db",
  },
  // @ts-ignore — migrate.adapter is valid in Prisma 7 but not yet in all type defs
  migrate: {
    adapter: () => new PrismaLibSql({ url, authToken }),
  },
});
