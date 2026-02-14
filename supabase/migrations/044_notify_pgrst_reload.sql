-- Force PostgREST to reload schema cache after function signature changes
NOTIFY pgrst, 'reload schema';
