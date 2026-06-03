# Supabase Integration Plan

## Mục tiêu

Hiện tại app WC 2026 đang chạy thuần FE Angular và đọc dữ liệu từ JSON tĩnh trong `public/data`.
Mục tiêu khi thêm Supabase là dùng Supabase như một backend nhẹ để lưu dữ liệu đội bóng,
lịch thi đấu, kết quả và hỗ trợ đồng bộ dữ liệu mà không cần tự xây backend riêng.

## Hiện trạng

- Angular app dùng standalone components, signals và `httpResource`.
- Dữ liệu hiện nằm trong:
  - `public/data/teams.json`
  - `public/data/matches.json`
- `FootballApiService` đọc JSON rồi expose các computed state:
  - `teams`
  - `matches`
  - `schedule`
  - `results`
  - `standings`
- Route ẩn `/sync-data` hiện chỉ fetch/generate/download JSON từ nguồn `openfootball`.
- Script `npm run sync:data` có thể fetch dữ liệu thật và ghi lại JSON local.

## Vì sao Supabase phù hợp

Supabase phù hợp cho dự án này vì:

- Có Postgres để lưu dữ liệu có cấu trúc.
- Có API tự động để Angular đọc/ghi dữ liệu trực tiếp.
- Có Row Level Security để cho phép public read nhưng kiểm soát write.
- Có Edge Functions nếu sau này muốn sync data phía server.
- Không cần tự build REST API riêng.

## Kiến trúc đề xuất

```text
Angular FE
  |
  | supabase-js
  v
Supabase Postgres
  |
  +-- teams
  +-- matches
  +-- sync_logs

Optional later:
Supabase Edge Function
  |
  +-- fetch openfootball data
  +-- upsert teams/matches
```

## Schema đề xuất

```sql
create table teams (
  id int primary key,
  name text not null,
  short_name text not null,
  crest text not null,
  "group" text
);

create table matches (
  id int primary key,
  utc_date timestamptz not null,
  status text not null,
  stage text not null,
  "group" text,
  matchday int not null,
  home_team_id int references teams(id),
  away_team_id int references teams(id),
  home_score int,
  away_score int,
  venue text
);

create table sync_logs (
  id bigint generated always as identity primary key,
  source text not null,
  teams_count int not null,
  matches_count int not null,
  created_at timestamptz not null default now()
);
```

## RLS policy đề xuất

Dữ liệu lịch thi đấu và kết quả là public, nên có thể cho public read:

```sql
alter table teams enable row level security;
alter table matches enable row level security;
alter table sync_logs enable row level security;

create policy "Public teams are readable"
on teams for select
using (true);

create policy "Public matches are readable"
on matches for select
using (true);

create policy "Public sync logs are readable"
on sync_logs for select
using (true);
```

Với write/upsert, không nên để public anonymous user ghi trực tiếp trong production.
Giai đoạn đầu có thể dùng route ẩn để thử nghiệm, nhưng hướng tốt hơn là dùng Edge Function
hoặc Supabase service role ở môi trường server.

## Roadmap triển khai

### Phase 0: Chuẩn bị Supabase project

- Chạy SQL trong `docs/supabase-schema.sql` bằng Supabase SQL Editor.
- Lấy Project URL và anon public key trong Supabase Project Settings -> API.
- Điền vào `src/environments/environment.ts`:

```ts
export const environment = {
  supabase: {
    url: 'https://<project-ref>.supabase.co',
    anonKey: '<anon-public-key>',
  },
};
```

### Phase 1: Kết nối Supabase để đọc dữ liệu

- Cài `@supabase/supabase-js`.
- Tạo `environment.ts` / `environment.prod.ts` chứa:
  - `supabaseUrl`
  - `supabaseAnonKey`
- Tạo `SupabaseClientService`.
- Tạo `SupabaseFootballService` đọc `teams` và `matches`.
- Giữ JSON hiện tại làm fallback nếu Supabase lỗi.

Trạng thái hiện tại: đã implement theo hướng facade trong `FootballApiService`.
Service sẽ ưu tiên Supabase nếu có config, nếu không sẽ fallback về static JSON.

### Phase 2: Import dữ liệu hiện có lên Supabase

- Viết script Node đọc `public/data/teams.json` và `public/data/matches.json`.
- Upsert vào bảng `teams` và `matches`.
- Dùng anon key chỉ cho read, còn import nên dùng service role key ở local script.
- Không commit service role key vào repo.

### Phase 3: Thay `/sync-data` để sync vào Supabase

- Route `/sync-data` fetch nguồn `openfootball`.
- Generate data theo format hiện tại.
- Upsert vào Supabase.
- Ghi record vào `sync_logs`.

Trạng thái hiện tại: route `/sync-data` đã có nút upsert vào Supabase khi Supabase configured.

Lưu ý: nếu route này chạy từ browser, anon key có thể bị lộ và policy write phải mở.
Chỉ nên dùng cho demo hoặc repo cá nhân.

### Phase 4: Chuyển sync sang Edge Function

- Tạo Supabase Edge Function `sync-worldcup-data`.
- Function fetch `openfootball`.
- Function dùng service role để upsert dữ liệu.
- FE route `/sync-data` chỉ gọi function, không trực tiếp ghi database.
- Có thể đặt lịch chạy bằng Supabase Scheduler hoặc GitHub Actions.

## Thay đổi code dự kiến

```text
src/app/core/services/
  supabase-client.service.ts
  supabase-football.service.ts
  football-api.service.ts

src/environments/
  environment.ts
  environment.prod.ts

tools/
  import-supabase-data.mjs
```

`FootballApiService` nên giữ vai trò facade cho app:

- App vẫn gọi `FootballApiService`.
- Bên trong service quyết định đọc từ Supabase hoặc fallback JSON.
- UI không cần biết dữ liệu đến từ JSON hay Supabase.

## Environment variables

Các key public về mặt kỹ thuật có thể xuất hiện trong frontend bundle:

- `supabaseUrl`
- `supabaseAnonKey`

Tuy nhiên với repo public, không nên commit trực tiếp vào source. Dự án hiện dùng GitHub
Actions secrets để tạo `src/environments/environment.ts` lúc build:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Local `environment.ts` có thể để trống; khi đó app tự fallback về JSON tĩnh.

Không được commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- database password
- access token cá nhân

Nếu cần script import local, dùng `.env.local` và thêm vào `.gitignore`.

## GitHub Pages lưu ý

App deploy ở subpath:

```text
https://hieuntt95.github.io/wc-2026/
```

Nếu gọi Supabase thì không phụ thuộc static file path nữa.
Tuy nhiên vẫn cần giữ `--base-href /wc-2026/` và SPA fallback `404.html` trong workflow
để Angular routing hoạt động khi refresh deep link.

## Kết luận

Supabase là lựa chọn hợp lý để thay thế backend cho app này.
Nên triển khai theo hướng từng bước:

1. Đọc dữ liệu từ Supabase.
2. Import dữ liệu JSON hiện có.
3. Cho `/sync-data` ghi vào Supabase.
4. Nâng cấp sync sang Edge Function để an toàn hơn.
