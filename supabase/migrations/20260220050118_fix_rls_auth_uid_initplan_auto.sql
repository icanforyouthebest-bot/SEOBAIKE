-- 自動批次修復所有 RLS 政策中的 auth_rls_initplan 問題
-- 將 auth.uid() 直接呼叫改為 (SELECT auth.uid()) 以避免每行重新初始化查詢計劃
-- 大幅提升 RLS 效能（尤其是大資料表）
DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  fix_count int := 0;
  fail_count int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%')
        OR
        (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%')
      )
    ORDER BY tablename, policyname
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '(SELECT auth.uid())', '##UID_OK##');
      new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
      new_qual := replace(new_qual, '##UID_OK##', '(SELECT auth.uid())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '(SELECT auth.uid())', '##UID_OK##');
      new_check := replace(new_check, 'auth.uid()', '(SELECT auth.uid())');
      new_check := replace(new_check, '##UID_OK##', '(SELECT auth.uid())');
    END IF;

    BEGIN
      IF pol.cmd = 'INSERT' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename, new_check);
        END IF;
      ELSIF pol.cmd = 'SELECT' THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
          pol.policyname, pol.schemaname, pol.tablename, COALESCE(new_qual, 'true'));
      ELSIF pol.cmd = 'DELETE' THEN
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
      RAISE WARNING 'SKIP % on %.%: %', pol.policyname, pol.schemaname, pol.tablename, SQLERRM;
      fail_count := fail_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'auth_rls_initplan fix done — fixed: %, skipped: %', fix_count, fail_count;
END $$;
