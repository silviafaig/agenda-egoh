-- Fotos de prendas, logo y portada (Supabase Storage). Carpeta = id del showroom.
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
  on conflict (id) do update set public = true;

drop policy if exists fotos_subir on storage.objects;
create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists fotos_cambiar on storage.objects;
create policy fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists fotos_borrar on storage.objects;
create policy fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
