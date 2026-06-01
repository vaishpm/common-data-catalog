create schema if not exists data_catalog;

create table if not exists data_catalog.assets (
  asset_id varchar(512) primary key,
  database_name varchar(128) not null,
  schema_name varchar(128) not null,
  asset_name varchar(256) not null,
  asset_type varchar(64) not null,
  domain varchar(128),
  description varchar(65535),
  business_owner varchar(256),
  technical_owner varchar(256),
  refresh_cadence varchar(128),
  freshness_status varchar(128),
  certification_status varchar(64) default 'Needs review',
  tags varchar(2048),
  created_at timestamp default getdate(),
  updated_at timestamp default getdate()
);

create table if not exists data_catalog.columns (
  asset_id varchar(512) not null,
  ordinal_position integer,
  column_name varchar(256) not null,
  data_type varchar(256),
  is_nullable boolean,
  description varchar(65535),
  tags varchar(2048),
  created_at timestamp default getdate(),
  updated_at timestamp default getdate(),
  primary key (asset_id, column_name)
);

create table if not exists data_catalog.asset_consumers (
  asset_id varchar(512) not null,
  consumer_name varchar(256) not null,
  consumer_type varchar(64),
  url varchar(2048),
  primary key (asset_id, consumer_name)
);

create table if not exists data_catalog.asset_quality_signals (
  asset_id varchar(512) primary key,
  row_count bigint,
  size_mb numeric(18,2),
  last_analyzed_at timestamp,
  last_loaded_at timestamp,
  query_count_7d bigint,
  query_count_30d bigint,
  last_queried_at timestamp,
  updated_at timestamp default getdate()
);
