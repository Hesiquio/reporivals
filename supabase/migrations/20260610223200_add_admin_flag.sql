-- Migration: Add is_admin column to students table
ALTER TABLE public.students ADD COLUMN is_admin BOOLEAN DEFAULT false NOT NULL;
