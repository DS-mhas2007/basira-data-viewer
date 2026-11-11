import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import { fileURLToPath } from "url";

// اختبار منطق حدود الاستخدام على Postgres حقيقي (PGlite) بدون أي خدمة خارجية.
// التشغيل:  npm i --no-save @electric-sql/pglite && node supabase/tests/ai_quota.mjs
const MIGRATION = fileURLToPath(new URL("../migrations/20261111100000_ai_quota.sql", import.meta.url));
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub','')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
`);
await db.exec(fs.readFileSync(MIGRATION, "utf8"));
const A="00000000-0000-0000-0000-00000000000a", B="00000000-0000-0000-0000-00000000000b";
await db.exec(`insert into auth.users values ('${A}'),('${B}')`);
const as = async (uid, anon=false) => db.exec(`select set_config('request.jwt.claims','${JSON.stringify({sub:uid,is_anonymous:anon})}',false)`);
const call = async (action=null) => (await db.query(`select public.consume_ai_quota(${action?`'${action}'::uuid`:"null"}) r`)).rows[0].r;
let fails=0; const ok=(c,m)=>{console.log(c?"PASS":"FAIL",m); if(!c) fails++;};

// anonymous: 5 lifetime
await as(A,true);
let r; for(let i=0;i<5;i++) r=await call();
ok(r.allowed && r.remaining===0 && r.plan==="anonymous" && r.limit===5, "anon uses 5th request, remaining 0");
r=await call(); ok(!r.allowed && r.reason==="quota_exceeded", "anon 6th blocked");

// same action id counts once
await as(B,true);
const act="11111111-1111-1111-1111-111111111111";
r=await call(act); ok(r.allowed && r.used===1,"action first call charged");
for(let i=0;i<10;i++) r=await call(act);
ok(r.allowed && r.used===1,"11 calls same action still used=1");
for(let i=0;i<19;i++) r=await call(act);   // calls now 30
r=await call(act); ok(!r.allowed && r.reason==="action_limit","31st call in one action capped");

// anonymous -> registered (same uid) becomes free, monthly 30, trial rows count this month
await as(A,false);
r=await call(); ok(r.allowed && r.plan==="free" && r.used===6 && r.limit===30,"linked account is free plan, counts 5 trial rows");
for(let i=0;i<24;i++) r=await call();
ok(r.allowed && r.remaining===0,"free reaches 30");
r=await call(); ok(!r.allowed,"free 31st blocked");

// month rollover: old rows do not count
await db.exec(`update public.ai_usage set created_at = now() - interval '40 days' where user_id='${A}'`);
r=await call(); ok(r.allowed && r.used===1,"previous-month usage does not count");

// upgrade to pro raises limit
await db.exec(`insert into public.user_plans(user_id,plan) values ('${A}','pro')`);
r=await call(); ok(r.allowed && r.plan==="pro" && r.limit===1000,"pro plan limit applied");

// limits editable without deploy
await db.exec(`update public.plan_limits set max_requests=2 where plan='free'`);
await as(B,false);
await db.exec(`delete from public.ai_usage where user_id='${B}'`);
await call(); await call(); r=await call();
ok(!r.allowed && r.limit===2,"editing plan_limits changes the limit");

// unauthenticated
await db.exec(`select set_config('request.jwt.claims','{}',false)`);
let threw=false; try{ await call(); }catch(e){ threw=/not_authenticated/.test(String(e.message)); }
ok(threw,"no auth.uid() raises not_authenticated");

// users cannot write tables directly
await db.exec(`set role authenticated`);
await as(A,false);
let denied=false; try{ await db.exec(`insert into public.ai_usage(user_id) values ('${A}')`);}catch(e){denied=true;}
ok(denied,"authenticated cannot insert into ai_usage directly");
denied=false; try{ await db.exec(`update public.user_plans set plan='team' where user_id='${A}'`);}catch(e){denied=true;}
ok(denied,"authenticated cannot change own plan");
let n=(await db.query(`select count(*)::int c from public.ai_usage`)).rows[0].c;
await as(B,false); let nb=(await db.query(`select count(*)::int c from public.ai_usage`)).rows[0].c;
ok(nb < n || nb===(await db.query(`select count(*)::int c from public.ai_usage where user_id='${B}'`)).rows[0].c,"RLS: user B only sees own usage");
r=(await db.query(`select public.consume_ai_quota(null) r`)).rows[0].r;
ok(r.plan==="free","function callable as authenticated role");
console.log(fails? "FAILURES: "+fails : "ALL PASS");
