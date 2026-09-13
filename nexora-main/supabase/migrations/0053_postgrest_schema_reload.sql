-- v5.02.2: request a PostgREST schema-cache refresh after the LIA runtime/use-case migrations.
-- No tables, rows, permissions or financial data are modified by this statement.
notify pgrst, 'reload schema';
