-- 清除 auth_rls_initplan 修復過程中產生的雙重嵌套
-- (SELECT (SELECT auth.uid() AS uid) AS uid) → ( SELECT auth.uid() AS uid)
DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  fix_count int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual LIKE '%SELECT ( SELECT auth.uid()%'
        OR qual LIKE '%SELECT (SELECT auth.uid()%'
        OR with_check LIKE '%SELECT ( SELECT auth.uid()%'
        OR with_check LIKE '%SELECT (SELECT auth.uid()%'
      )
    ORDER BY tablename, policyname
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual,
        '\( SELECT \( SELECT auth\.uid\(\) AS uid\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_qual := regexp_replace(new_qual,
        '\(SELECT \(SELECT auth\.uid\(\) AS uid\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_qual := regexp_replace(new_qual,
        '\( SELECT \(SELECT auth\.uid\(\)\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_qual := regexp_replace(new_qual,
        '\(SELECT \( SELECT auth\.uid\(\) AS uid\)\)',
        '( SELECT auth.uid() AS uid)', 'g');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check,
        '\( SELECT \( SELECT auth\.uid\(\) AS uid\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_check := regexp_replace(new_check,
        '\(SELECT \(SELECT auth\.uid\(\) AS uid\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_check := regexp_replace(new_check,
        '\( SELECT \(SELECT auth\.uid\(\)\) AS uid\)',
        '( SELECT auth.uid() AS uid)', 'g');
      new_check := regexp_replace(new_check,
        '\(SELECT \( SELECT auth\.uid\(\) AS uid\)\)',
        '( SELECT auth.uid() AS uid)', 'g');
    END IF;

    BEGIN
      IF pol.cmd = 'INSERT' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename, new_check);
        END IF;
      ELSIF pol.cmd IN ('SELECT', 'DELETE') THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
          pol.policyname, pol.schemaname, pol.tablename, COALESCE(new_qual, 'true'));
      ELSIF pol.cmd = 'UPDATE' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename,
            COALESCE(new_qual, 'true'), new_check);
        ELSE
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
            pol.policyname, pol.schemaname, pol.tablename, COALESCE(new_qual, 'true'));
        END IF;
      ELSIF pol.cmd = 'ALL' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename,
            COALESCE(new_qual, 'true'), new_check);
        ELSIF new_qual IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
            pol.policyname, pol.schemaname, pol.tablename, new_qual);
        END IF;
      END IF;
      fix_count := fix_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SKIP % on %.%: %',
        pol.policyname, pol.schemaname, pol.tablename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Double-nesting fix done — fixed: %', fix_count;
END $$;
