import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "./env";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient({ datasourceUrl: databaseUrl() });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
