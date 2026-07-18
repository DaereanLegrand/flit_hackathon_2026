grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on qr_codes to anon, authenticated, service_role;
grant select, insert, update on room_participants to anon, authenticated, service_role;
grant select, insert, update on room_votes to anon, authenticated, service_role;
