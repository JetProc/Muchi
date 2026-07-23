-- Public buckets serve object URLs without a broad SELECT policy. Removing it prevents
-- anonymous bucket listing while retaining public image delivery.
drop policy if exists "public can read chapter covers" on storage.objects;
