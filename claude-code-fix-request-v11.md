# Military Shooter 2D — Master Change Request v11 (ต่อยอดจาก v2-v10)

v2-v10 ยังใช้ได้ทั้งหมด ไฟล์นี้เพิ่มเรื่อง Supabase credentials ที่ตั้งค่าไว้ให้แล้ว

---

## 1. Supabase ตั้งค่าไว้ให้แล้วใน `.env` และ `.env.example`

เพิ่ม env vars ต่อไปนี้ลงใน `D:\Online_game\.env` แล้ว (ใช้ค่าจริงของโปรเจกต์ผู้ใช้) และเพิ่ม placeholder ใน `.env.example` ด้วย:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
**แก้ไขจากที่ผู้ใช้ให้มา:** URL ที่ผู้ใช้หามาตอนแรกมี `/rest/v1/` ต่อท้าย (`https://xxx.supabase.co/rest/v1/`) — ตัดออกแล้วเหลือแค่ `https://xxx.supabase.co` เพราะ `@supabase/supabase-js` client ต่อ REST path นี้ให้เองอัตโนมัติ ถ้าใส่ URL แบบมี path ต่อท้ายจะทำให้ client ต่อ URL ผิดซ้อนกัน (double path) แล้ว connect ไม่ได้

ให้ Claude Code ทำตามแผนงานเต็มใน `claude-code-fix-request-v10.md` ข้อ 5 ต่อจากนี้:
1. `npm install @supabase/supabase-js`
2. สร้าง `src/lib/supabase/client.ts` (server-side client ใช้ `SUPABASE_SERVICE_ROLE_KEY`, อย่าใช้ client-side กับ key นี้เด็ดขาด)
3. เขียน SQL migration สร้างตารางตาม schema ที่ระบุไว้ใน v9/v10 (players, player_weapon, player_equipment, player_equipment_level, player_character, player_weapon_ammo, player_passive, player_stage_progress, player_mission, player_income, player_boss_progress) — รันผ่าน Supabase SQL Editor หรือ migration file ก็ได้
4. ค่อยๆ ย้าย API route ทีละกลุ่มจาก Google Sheets ไป Supabase (เริ่มจาก `Players`/auth ก่อนเพราะกระทบทุกหน้า) แล้วทดสอบให้แน่ใจว่า login/reset-test-account ยังทำงานถูกต้องก่อนย้ายส่วนถัดไป

**⚠️ ความปลอดภัย:** `SUPABASE_SERVICE_ROLE_KEY` ที่ให้มาเป็น key สิทธิ์เต็ม (bypass Row Level Security ทั้งหมด) ผ่านการพิมพ์ในแชทข้อความธรรมดามาแล้ว แนะนำให้ผู้ใช้ **พิจารณา regenerate key ใหม่** จากหน้า Supabase Dashboard → Project Settings → API หลังตั้งค่าเสร็จ เพื่อความปลอดภัยสูงสุด (ไม่บังคับ แต่เป็น best practice เมื่อ secret ผ่านช่องทางข้อความมาแล้ว) แล้วอัปเดตค่าใหม่ใน `.env`/Vercel ให้ตรงกัน

---

## 2. แผนผัง Stage 1-10 + Stage Farm — ส่งไฟล์ต้นฉบับให้ Claude Code โดยตรง

ไฟล์ต้นฉบับ (.pptx/.pdf) ให้ส่งแนบไปกับ prompt นี้ตรงๆ เลย (Claude Code อ่านไฟล์แนบได้ในเซสชันของมันเอง) — อธิบายให้ Claude Code ทราบว่าไฟล์นี้ระบุ: จุดเกิดผู้เล่น (player spawn point), จุดเกิดศัตรูแต่ละจุด (enemy spawn point) พร้อมชนิดศัตรู, และตำแหน่งวางสิ่งกีดขวาง (cover object) ต่อด่าน ทั้งหมด 10 ด่านทั่วไป + ด่านฟาร์ม 1 แมพ

ให้ Claude Code ทำ:
1. แปลงตำแหน่งจากแผนผัง เป็นพิกัด (x, y) จริงตาม stage `width`/`height` ที่กำหนดไว้ (v7 ข้อ 3 บอกให้ลดขนาดแมพลงมาแล้ว ~1280x720 ถึง 1600x900)
2. เขียนค่าลง sheet `StageEnemy` (stageId, enemyId, spawnX, spawnY) ตามชนิด/ตำแหน่งศัตรูในแผนผังจริงของแต่ละด่าน แทนที่ placeholder เดิม
3. วาง cover object (ใช้ 6 แบบที่มี: `cover_sandbag`, `cover_crate`, `obstacle_tree`, `obstacle_wall`, `obstacle_house`, `obstacle_camp_tent`) ตามตำแหน่งในแผนผังจริง ไม่ใช่สุ่มอีกต่อไปสำหรับ 10 ด่านนี้ (ด่านอื่นที่ผู้ใช้ยังไม่ได้ออกแบบ ค่อยสุ่มไปพลางตามเดิม)
4. ด่านฟาร์ม: ใช้ตำแหน่ง spawn/cover ตามแผนผังเป็น "แมพฐาน" แล้ว logic wave scaling (v4 ข้อ 4) ยังทำงานเหมือนเดิม (จำนวนศัตรูเพิ่มตาม wave แต่ตำแหน่ง spawn point อ้างอิงจากแผนผังนี้)

---

## หมายเหตุสำคัญ: ทำไมผมส่งให้อ่านเองไม่ได้

ไฟล์ .pptx/.pdf ที่แนบมาในเซสชันนี้ ผมเปิดอ่านไม่ได้ตอนนี้เพราะเครื่องมือแปลงไฟล์ (poppler/pdftoppm) ที่ sandbox ของผมต้องใช้ในการแปลงหน้า PDF เป็นภาพ ใช้งานไม่ได้อยู่ (ปัญหาเดียวกับที่ sandbox รันโค้ดไม่ได้มาตลอดเซสชันนี้) เลยไม่สามารถอ่านตำแหน่ง/รายละเอียดในแผนผังให้คุณตรงๆ ได้ — **แนะนำให้แนบไฟล์ต้นฉบับไปกับ Claude Code โดยตรงเลย** (Claude Code สภาพแวดล้อมอื่น น่าจะอ่าน pptx/pdf ได้ปกติ) ไม่ต้องรอผมแปลงเป็นข้อความให้ก่อน
