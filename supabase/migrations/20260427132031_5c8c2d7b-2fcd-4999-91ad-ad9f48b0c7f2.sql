-- 1. Privilege escalation fix on user_roles
-- Drop the broad ALL policy and replace with explicit per-command policies
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

-- Admins can insert roles
CREATE POLICY "Admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update roles
CREATE POLICY "Admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete roles
CREATE POLICY "Admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrictive policy to prevent ANY non-admin INSERT, even via the
-- handle_new_user trigger path? The trigger runs as SECURITY DEFINER so
-- it bypasses RLS — we are safe there. This restrictive INSERT blocks
-- regular client inserts entirely unless caller is admin.
CREATE POLICY "Block non-admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;