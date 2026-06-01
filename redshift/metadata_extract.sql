select
  current_database() || '.' || n.nspname || '.' || c.relname as asset_id,
  current_database() as database_name,
  n.nspname as schema_name,
  c.relname as asset_name,
  case c.relkind
    when 'r' then 'table'
    when 'v' then 'view'
    when 'm' then 'materialized view'
    else c.relkind::varchar
  end as asset_type,
  coalesce(obj_description(c.oid), '') as asset_description,
  a.attname as column_name,
  a.attnum as ordinal_position,
  t.typname as data_type,
  not a.attnotnull as is_nullable,
  coalesce(col_description(c.oid, a.attnum), '') as column_description
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
join pg_type t on t.oid = a.atttypid
where n.nspname in (
  'reporting',
  'companies',
  'supplier_offers',
  'ontology',
  'metrics_layer',
  'references'
)
  and c.relkind in ('r', 'v', 'm')
  and a.attnum > 0
  and not a.attisdropped
order by
  n.nspname,
  c.relname,
  a.attnum;
