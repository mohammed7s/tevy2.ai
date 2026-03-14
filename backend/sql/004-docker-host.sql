-- Docker host support — store the mapped port for each instance
alter table public.instances add column if not exists host_port integer;
