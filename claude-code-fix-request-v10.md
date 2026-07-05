# Military Shooter 2D — Master Change Request v10 (ต่อยอดจาก v2-v9)

v2-v9 ยังใช้ได้ทั้งหมด ไฟล์นี้แก้/เพิ่มเฉพาะเรื่องด้านล่าง

หมายเหตุ: เรื่อง **แผนผัง Stage 1-10 + Stage Farm** (จุดเกิดผู้เล่น/ศัตรู/ชนิดศัตรู/การวางสิ่งกีดขวาง) ผู้ใช้จะส่งเป็นไฟล์แยกต่างหาก (ภาพ/PDF) เพิ่มเติม จะตามมาเป็น `claude-code-fix-request-v11.md` เมื่อได้รับไฟล์ ให้รอไฟล์นั้นก่อนแล้วค่อยลงมือวางตำแหน่งจริงในแต่ละด่าน

---

## 1. กาชาแบบสุ่ม 10 ครั้งพร้อมกัน + ลดราคา 5%

- เพิ่มปุ่ม "สุ่ม x10" ควบคู่กับปุ่มสุ่มทีละครั้งเดิม ทั้ง 2 บ่อ (กาชาเพชร, กาชา ticket)
- ราคาต่อครั้งเมื่อกดสุ่ม x10 **ถูกลง 5%** จากราคาปกติ x10 เท่า (เช่น กาชาเพชรปกติ 100 เพชร/ครั้ง → x10 ปกติจะเป็น 1,000 แต่ลด 5% เหลือ **950 เพชร** ต่อการสุ่ม 10 ครั้ง, กาชา ticket เดิม 100 ticket/ครั้ง → x10 ลด 5% เหลือ **950 ticket**)
- ผลลัพธ์ทั้ง 10 ครั้งสุ่ม independent ตาม drop table เดิม (v3) แล้วแสดงผลรวมทีเดียวเป็น grid/carousel (ใช้ animation เดียวกับสุ่มเดี่ยวจาก v6 ข้อ 1 แต่ทำเป็น sequence เร็วขึ้นหรือแสดงเป็นชุดพร้อมกันก็ได้ ขอให้ดู "อลังการ" เหมือนเดิม)
- ระบบ dupe/อัปเกรดดาว (v6 ข้อ 2) ต้องทำงานถูกต้องกับผลจากการสุ่ม x10 ด้วย (เช็ค dupe ทีละชิ้นในชุด 10 ชิ้นนั้น)

---

## 2. ระบบ Mission เต็มรูปแบบ (แทนที่ค่า placeholder เดิมทั้งหมด)

แบ่งเป็น 2 หมวดใน sheet `Mission` (type = `personal` / `daily`) ตามที่กำหนด:

### Mission ส่วนตัว (ทำครั้งเดียว ไม่ reset)

| เงื่อนไข | เหรียญ | Exp | เพชร |
|---|---|---|---|
| กำจัดศัตรู 100 ตัว | 200 | 300 | 20 |
| กำจัดศัตรู 1,000 ตัว | 500 | 500 | 20 |
| กำจัดศัตรู 10,000 ตัว | 1,000 | 1,500 | 50 |
| ผ่านด่าน 5 | 200 | 200 | 20 |
| ผ่านด่าน 10 | 300 | 400 | 30 |
| ด่านฟาร์มถึง wave 5 | 100 | 100 | 5 |
| ด่านฟาร์มถึง wave 10 | 200 | 200 | 10 |
| ด่านฟาร์มถึง wave 15 | 300 | 300 | 15 |
| ด่านฟาร์มถึง wave 20 | 400 | 400 | 20 |

**Pattern ด่านฟาร์ม (generate ต่อเนื่องไม่ต้อง hardcode ทีละแถว):** ทุกๆ wave 5 ที่เพิ่มขึ้น (25, 30, 35, ...) ให้ milestone ถัดไป เพิ่มรางวัลอีก **100 เหรียญ, 100 Exp, 5 เพชร** จาก milestone ก่อนหน้าตามลำดับ (เช่น wave 25 = 500 เหรียญ/500 Exp/25 เพชร, wave 30 = 600/600/30 ไปเรื่อยๆ) — เขียนเป็นสูตร `reward = base + (milestoneIndex * step)` ใน backend แทนการ seed ทีละแถวไม่รู้จบ

### Mission รายวัน (reset ทุกวัน)

| เงื่อนไข | เหรียญ | Exp | เพชร |
|---|---|---|---|
| กำจัดศัตรู 10 ตัว | 50 | 100 | 5 |

(อันนี้ตรงกับเควสรายวันที่ระบุไว้แล้วใน v4 ข้อ 2 — ปรับให้ตรงตัวเลขนี้ใหม่ล่าสุดแทนของเดิมถ้าตัวเลขต่างกัน: v4 บอกแค่เพชร 5 ไม่มี เหรียญ/Exp ระบุ ให้ใช้ตัวเลขจากไฟล์นี้แทนคือ 50 เหรียญ + 100 Exp + 5 เพชร)

- หน้า Mission: แยก 2 แท็บ/section ชัดเจน "ภารกิจส่วนตัว" กับ "ภารกิจรายวัน" พร้อม progress bar ต่อภารกิจ และปุ่ม "รับรางวัล" (claim) เมื่อครบเงื่อนไข

---

## 3. เปลี่ยนอาวุธในมือให้ตรงกับที่ equip จริง (สร้างความสมจริง)

ตอนนี้ตัวละครในเกมอาจจะถืออาวุธเดียวตายตัวไม่เปลี่ยนตามที่ equip — แก้ให้:
- เมื่อผู้เล่นเปลี่ยนอาวุธที่ equip อยู่ (ในหน้าคลังอาวุธ) sprite ของตัวละครขณะเล่นเกมจริงต้องเปลี่ยนตาม (แสดงอาวุธที่ถืออยู่ในมือให้ตรงกับ weaponId ที่ equip)
- Implementation แนะนำ: ทำ layer sprite อาวุธแยกซ้อนทับตัวละคร (child sprite/container ผูกกับ player sprite) หมุนตามทิศเล็งเดียวกับตัวละคร แล้วสลับ texture ของ layer นี้ตาม `equippedWeaponId` (ใช้ sprite อาวุธที่มีอยู่แล้วจาก `public/assets/sprites/weapons/`)
- ต้องอัปเดตทั้งตอนเข้าเกม (โหลดจาก equip state ปัจจุบัน) และถ้าเป็นไปได้ให้ preview ในหน้าคลังอาวุธ/inventory ด้วย (ตัวละครในหน้านั้นถืออาวุธที่เลือกอยู่เช่นกัน)

---

## 4. เพิ่มทรัพยากรจาก 3 เป็น 5 ชนิด (แสดงในทุกหน้า)

ทรัพยากรเดิม 3 อย่าง: เหรียญ (coin), เพชร (diamond), ticket — เพิ่มอีก 2 อย่างที่มีอยู่ในระบบแล้วจากรอบก่อนๆ แต่ยังไม่ถูกแสดงเป็น "ทรัพยากรหลัก" อย่างเป็นทางการ:
- **Exp** — สะสมจากผ่านด่าน/ภารกิจ (ใช้ทั้งเลเวลตัวละครและ VIP exp ตาม v9 ข้อ 2)
- **แบงค์เขียว (Green Banknote)** — จากการฆ่าบอส/ภารกิจ ตาม v4 ข้อ 5

แก้ `CurrencyBar.tsx` (component ที่มีอยู่แล้ว) ให้แสดงครบทั้ง **5 ทรัพยากร** ในทุกหน้าที่มีแถบทรัพยากรอยู่แล้ว (Home, Gacha, Shop, Mission, Inventory ฯลฯ) ไม่ใช่แค่ 3 อย่างเดิม ใช้ไอคอนแยกแต่ละอย่างให้ดูออกง่าย (เหรียญ=ทอง, เพชร=ฟ้า, ticket=ม่วง/เขียวตามที่ออกแบบไว้, Exp=ดาว/XP bar, แบงค์เขียว=ไอคอนธนบัตร)

---

## 5. ย้ายฐานข้อมูลเกมไปแอปออนไลน์ที่เหมาะสมและปลอดภัย (แก้ปัญหา Google Sheets ค้าง/ช้า/บั๊ก อย่างจริงจัง)

ตามที่เตือนไว้ใน v9 ข้อ 3 ว่า Google Sheets ไม่เหมาะเป็น production database ของเกม ตอนนี้ปัญหาหนักขึ้นจนต้องย้ายจริงจัง แนะนำสถาปัตยกรรมใหม่นี้:

### สถาปัตยกรรมที่แนะนำ: Supabase (Postgres) เป็นฐานข้อมูล runtime + Google Sheets เป็นแค่เครื่องมือแก้ config

**เหตุผลที่เลือก Supabase:** ฟรีเทียร์ใจดี (500MB, ไม่มี cold-start แบบ serverless DB อื่น), เป็น Postgres มาตรฐาน (SQL เต็มรูปแบบ, ACID transaction จริง แก้ปัญหา race condition ของ Sheets ได้), มี client library เข้ากับ Next.js/Vercel ได้ลื่นมาก, รองรับ Row Level Security ถ้าจะเปิด public read ในอนาคต, deploy คู่กับ Vercel ได้ทันทีไม่ต้องตั้ง server เอง

**แผนการย้าย:**

1. **ข้อมูลที่ย้ายไป Supabase (runtime data ที่อ่าน/เขียนถี่):** `players`, `player_weapon`, `player_equipment`, `player_equipment_level`, `player_character`, `player_weapon_ammo`, `player_passive`, `player_stage_progress`, `player_mission`, `player_income`, `player_boss_progress` — ทั้งหมดนี้แปลงจาก Google Sheet เป็นตาราง Postgres ตรงๆ (schema เดียวกับที่ออกแบบไว้ใน v2/v3/v4/v9 อยู่แล้ว)
2. **ข้อมูลที่ยังคงให้แก้ผ่าน Google Sheets ได้ (config ที่ผู้ใช้อยากแก้เองบ่อยๆ ไม่ต้องแตะโค้ด):** `Characters`, `Weapons`, `Equipment`, `Enemies`, `Stage`, `StageEnemy`, `PassiveConfig`, `GachaConfig`, `CurrencyExchangeConfig`, `TicketTopUp`, `VipConfig`, `BossStage`, `Mission`
3. เขียนสคริปต์ sync (`scripts/sync-config-from-sheets.ts`) ที่อ่าน config sheets ด้านบนแล้วเขียนลง Supabase ตาราง config เดียวกัน (ตาราง `game_config_*`) — รันตอน deploy หรือกดปุ่ม "Sync from Google Sheet" ในหน้า admin เอง (ไม่ auto-sync ทุก request แบบเดิมที่ทำให้ quota หมด) วิธีนี้ผู้ใช้ยังแก้ค่าใน Google Sheet ได้เหมือนเดิมทุกประการ แค่กดปุ่ม sync 1 ครั้งหลังแก้เสร็จแล้วค่อยมีผลจริงในเกม (เร็วกว่าเดิมมากเพราะเกม runtime อ่านจาก Postgres ไม่ใช่ Sheets แล้ว)
4. แก้ทุก API route ที่เคย import จาก `src/lib/google/*` (player.ts, inventory.ts, character.ts, weapon.ts, stage.ts) ให้เปลี่ยนไปเรียก Supabase client แทน (`src/lib/db/*.ts` ใหม่) — คง interface/return type เดิมให้มากที่สุดเพื่อลดจุดที่ต้องแก้ในโค้ดฝั่ง UI
5. เพิ่ม dependency: `npm install @supabase/supabase-js`
6. Environment variables ใหม่ที่ต้องตั้งทั้งใน `.env.local` (dev) และ Vercel Project Settings (production): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (ใช้ฝั่ง server เท่านั้น ห้าม expose ฝั่ง client)

**งานนี้เป็นงานสถาปัตยกรรมใหญ่กว่ารอบอื่นๆ ที่ผ่านมา — ให้ Claude Code แจ้งแผนงานย่อย/เวลาโดยประมาณกลับมาก่อนเริ่มลงมือ เพราะกระทบเกือบทุก API route ในโปรเจกต์**

---

## 6. โค้ด/ขั้นตอน Deploy ขึ้น Vercel (ทำได้เลยตอนนี้ ไม่ต้องรอข้อ 5 เสร็จ)

Deploy ขึ้น Vercel ทำได้อยู่แล้วตอนนี้แม้ยังไม่ย้าย DB (แค่ยังจะเจอปัญหาช้า/quota เดิมต่อจนกว่าจะทำข้อ 5 เสร็จ) ขั้นตอน:

### 6.1 เตรียมโค้ดให้พร้อม (ให้ Claude Code ทำ)

สร้าง/แก้ไฟล์ `vercel.json` ที่ root โปรเจกต์:
```json
{
  "framework": "nextjs",
  "regions": ["sin1"],
  "buildCommand": "next build",
  "installCommand": "npm install"
}
```

แก้ `src/lib/google/auth.ts` (จุดที่โหลด `credentials.json`) ให้อ่านจาก environment variable แทนไฟล์ตรงๆ:
```ts
// เดิม: อ่านจากไฟล์ credentials.json ตรงๆ — ใช้ไม่ได้บน Vercel (filesystem read-only + ไม่ควร commit ไฟล์ credential ขึ้น repo)
// ใหม่: อ่านจาก env var ที่เป็น base64 ของไฟล์ credentials.json
const credentialsJson = Buffer.from(
  process.env.GOOGLE_CREDENTIALS_BASE64 || "",
  "base64"
).toString("utf-8");
const credentials = JSON.parse(credentialsJson);
```

เพิ่ม `.gitignore` entry ให้แน่ใจว่า `credentials.json`, `.env`, `.env.local` ไม่ถูก commit ขึ้น git (เช็คว่ามีอยู่แล้วหรือยัง)

### 6.2 แปลง credentials.json เป็น env var (ทำครั้งเดียวตอนนี้)

รันคำสั่งนี้ในเครื่องตัวเอง (ไม่ใช่ในนี้ เพราะ sandbox นี้เข้าไม่ถึงไฟล์จริงของโปรเจกต์คุณ) เพื่อแปลง `credentials.json` เป็น base64 string:

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json")) | Set-Clipboard
```
(ค่าจะถูกก็อปเข้า clipboard ให้เลย เอาไปวางในขั้นตอนถัดไป)

**Mac/Linux:**
```bash
base64 -i credentials.json | pbcopy   # mac
base64 -w0 credentials.json | xclip -selection clipboard   # linux
```

### 6.3 ขั้นตอน Deploy จริงบนเว็บ Vercel

1. Push โค้ดขึ้น GitHub repo (ถ้ายังไม่มี ให้สร้าง repo ใหม่แล้ว `git push`)
2. เข้า https://vercel.com → New Project → เลือก import จาก GitHub repo นี้
3. Framework Preset: Vercel จะ detect เป็น Next.js อัตโนมัติ ไม่ต้องแก้อะไร
4. ก่อนกด Deploy ให้ไปที่ "Environment Variables" แล้วเพิ่มทั้งหมดนี้ (ค่าตามที่มีในไฟล์ `.env`/`.env.local` ปัจจุบันของคุณ):
   - `GOOGLE_CREDENTIALS_BASE64` = ค่า base64 จากขั้นตอน 6.2
   - `GOOGLE_SPREADSHEET_ID` = spreadsheet id เดิม
   - `NEXTAUTH_SECRET` = ค่าเดิมจาก `.env` (หรือ generate ใหม่ด้วย `openssl rand -base64 32`)
   - `NEXTAUTH_URL` = URL จริงหลัง deploy (ตอนแรกใส่ `https://<project-name>.vercel.app` ไปก่อน แล้วแก้เป็น custom domain ทีหลังถ้ามี)
   - ตัวแปรอื่นๆ ทั้งหมดที่มีอยู่ใน `.env.example` ของโปรเจกต์ (ตรวจสอบให้ครบตามไฟล์นั้น)
5. กด Deploy รอ build เสร็จ (ปกติ 1-3 นาทีสำหรับโปรเจกต์ขนาดนี้)
6. ทดสอบ URL ที่ได้ทันที — ถ้า error ให้เช็ค "Deployment Logs" ใน Vercel dashboard ก่อน (ส่วนใหญ่เป็น env var ตกหล่นหรือพิมพ์ผิด)
7. ถ้าจะผูก custom domain ของตัวเอง ไปที่ Project Settings → Domains → เพิ่ม domain แล้วตั้งค่า DNS ตามที่ Vercel แนะนำ

---

## ลำดับความสำคัญที่แนะนำสำหรับรอบนี้

1. เตรียมโค้ด deploy Vercel (ข้อ 6.1) — เล็กและทำได้ทันที ไม่กระทบอะไรเดิม
2. แผนย้าย DB ไป Supabase (ข้อ 5) — งานใหญ่สุดแต่แก้ปัญหาต้นตอที่คุณเจอมาหลายรอบ
3. ระบบ Mission เต็มรูปแบบ (ข้อ 2) + กาชา x10 (ข้อ 1)
4. เปลี่ยนอาวุธในมือให้ตรง equip จริง (ข้อ 3) + แสดง 5 ทรัพยากร (ข้อ 4)
