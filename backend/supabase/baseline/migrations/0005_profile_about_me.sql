-- Add optional profile bio field used by the Profile screen.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS about_me TEXT;
