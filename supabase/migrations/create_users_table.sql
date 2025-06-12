-- Create users table
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  user_id char(8) unique not null,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Create policies
create policy "Users can view their own data."
  on public.users for select
  using ( auth.uid() = id );

create policy "Users can update their own data."
  on public.users for update
  using ( auth.uid() = id );

-- Create trigger to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_users_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();

-- Set up realtime
alter publication supabase_realtime add table public.users;