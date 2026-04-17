create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('super_admin', 'admin')
  );
$$;

create or replace function public.has_role(requested_role public.app_role, requested_site_code text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = requested_role
      and (
        ur.scope_site_code is null
        or requested_site_code is null
        or ur.scope_site_code = requested_site_code
      )
  );
$$;

create or replace function public.can_access_site(requested_site_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or requested_site_code is null
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.primary_site_code = requested_site_code
      )
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and (
            ur.scope_site_code is null
            or ur.scope_site_code = requested_site_code
          )
      )
    );
$$;

create or replace function public.can_view_notification(
  notification_audience text,
  notification_user_id uuid,
  notification_role public.app_role,
  notification_site_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      notification_audience = 'global'
      or (
        notification_audience = 'user'
        and notification_user_id = auth.uid()
      )
      or (
        notification_audience = 'role'
        and notification_role is not null
        and public.has_role(notification_role, notification_site_code)
      )
      or (
        notification_audience = 'site'
        and public.can_access_site(notification_site_code)
      )
    );
$$;

alter table public.sites enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_receipts enable row level security;
alter table public.documents enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;
alter table public.audit_logs enable row level security;
alter table public.customers enable row level security;
alter table public.accounts enable row level security;
alter table public.meters enable row level security;
alter table public.token_transactions enable row level security;
alter table public.meter_daily_reads enable row level security;
alter table public.meter_events enable row level security;
alter table public.remote_tasks enable row level security;
alter table public.theft_signals enable row level security;
alter table public.theft_cases enable row level security;
alter table public.theft_case_signals enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.site_consumption_facts enable row level security;

create policy "sites are readable by authenticated users"
  on public.sites
  for select
  to authenticated
  using (true);

create policy "profiles are readable by owner or admin"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles are insertable by owner or admin"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid() or public.is_admin());

create policy "profiles are updatable by owner or admin"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "user roles are readable by owner or admin"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "notifications are readable when targeted"
  on public.notifications
  for select
  to authenticated
  using (
    public.can_view_notification(audience, user_id, target_role, target_site_code)
    and (expires_at is null or expires_at > timezone('utc', now()))
  );

create policy "notifications are manageable by admins"
  on public.notifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "notification receipts belong to the signed-in user"
  on public.notification_receipts
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification receipts can be inserted by the signed-in user"
  on public.notification_receipts
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "notification receipts can be updated by the signed-in user"
  on public.notification_receipts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "documents are readable by admins site members or uploader"
  on public.documents
  for select
  to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or public.can_access_site(site_code)
  );

create policy "documents can be inserted by authenticated users"
  on public.documents
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_access_site(site_code)
  );

create policy "documents can be updated by admins or uploader"
  on public.documents
  for update
  to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
  )
  with check (
    public.is_admin()
    or uploaded_by = auth.uid()
  );

create policy "import jobs are readable by requester or admin"
  on public.import_jobs
  for select
  to authenticated
  using (
    requested_by = auth.uid()
    or public.is_admin()
  );

create policy "import jobs are insertable by requester"
  on public.import_jobs
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    or public.is_admin()
  );

create policy "import jobs are updatable by admins"
  on public.import_jobs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "import job rows are readable by requester or admin"
  on public.import_job_rows
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.import_jobs ij
      where ij.id = import_job_id
        and ij.requested_by = auth.uid()
    )
  );

create policy "audit logs are readable by admins"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

create policy "customers are readable by site access"
  on public.customers
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "accounts are readable by site access"
  on public.accounts
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "meters are readable by site access"
  on public.meters
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "token transactions are readable by site access"
  on public.token_transactions
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "meter daily reads are readable by site access"
  on public.meter_daily_reads
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "meter events are readable by site access"
  on public.meter_events
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "remote tasks are readable by requester admins or site access"
  on public.remote_tasks
  for select
  to authenticated
  using (
    requested_by = auth.uid()
    or public.is_admin()
    or public.can_access_site(site_code)
  );

create policy "remote tasks can be inserted by requester"
  on public.remote_tasks
  for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and public.can_access_site(site_code)
  );

create policy "theft signals are readable by site access"
  on public.theft_signals
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "theft cases are readable by site access"
  on public.theft_cases
  for select
  to authenticated
  using (public.can_access_site(site_code));

create policy "theft case signals are readable through case access"
  on public.theft_case_signals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.theft_cases tc
      where tc.id = theft_case_id
        and public.can_access_site(tc.site_code)
    )
  );

create policy "analysis runs are readable by admins"
  on public.analysis_runs
  for select
  to authenticated
  using (public.is_admin());

create policy "site consumption facts are readable by site access"
  on public.site_consumption_facts
  for select
  to authenticated
  using (public.can_access_site(site_code));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.notification_receipts;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.remote_tasks;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.analysis_runs;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
