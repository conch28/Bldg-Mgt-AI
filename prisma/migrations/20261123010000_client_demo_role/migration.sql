-- Read-only client demo role: prospects (e.g. New Clark City, Pax Silica) see their own sustainability demo.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';
