-- Read-only viewer roles for investors and whole-building owners.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVESTOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LANDLORD';
