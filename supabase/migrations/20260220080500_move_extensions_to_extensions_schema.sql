-- 將 vector 與 hstore extension 從 public 移至 extensions schema
-- 安全性：extensions 已在 search_path ("$user", public, extensions)
-- 現有欄位/函數透過 OID 綁定，移 schema 後自動跟隨，不需修改現有程式碼

ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION hstore SET SCHEMA extensions;
