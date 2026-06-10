-- Migration: Add total_contributions column to students table
ALTER TABLE public.students ADD COLUMN total_contributions INTEGER DEFAULT 0 NOT NULL;
