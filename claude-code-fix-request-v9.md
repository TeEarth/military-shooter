# Military Shooter 2D — Master Change Request v9 (ต่อยอดจาก v2-v8)

v2-v8 ยังใช้ได้ทั้งหมด ไฟล์นี้แก้/เพิ่มเฉพาะเรื่องด้านล่าง

Asset ที่แก้ไข: `bullet_razor.svg` ถูกปรับเป็นเส้นแนวนอนเรืองแสงฟ้าแล้ว (แก้ไขเองไว้แล้ว ไม่ต้องแตะ) และแก้ `bullet_rocket.svg` ใหม่ให้หัวจรวดชี้ไปทาง **ขวา** (+X) เป็นทิศตั้งต้น เพื่อให้ตรงกับ convention การหมุน sprite ตาม rotation angle (ดูข้อ 6)

---

## 1. Fix hitbox สิ่งกีดขวางแบบถาวร (ยังเป็นกรอบสี่เหลี่ยมอยู่)

ที่แก้ไปตาม v6 ข้อ 8 ยังไม่พอ ให้ทำใหม่แบบเจาะจงต่อชิ้นจริงๆ ใน `CoverObject.ts` (ไม่ใช้ default AABB เต็ม texture อีกต่อไปเด็ดขาด):

| Obstacle | รูปทรง hitbox ที่ควรใช้ | ค่าประมาณ (อิง viewBox ของ sprite) |
|---|---|---|
| `cover_sandbag.svg` | วงรี/วงกลมเล็ก (`body.setCircle`) | รัศมี ~40% ของความกว้างภาพ, offset ให้ตรงกลางกอง |
| `cover_crate.svg` | สี่เหลี่ยม (`setSize`+`setOffset`) | ให้ตรงกับกรอบไม้จริงในภาพ (ไม่รวม margin โปร่งใสรอบภาพ) |
| `obstacle_tree.svg` | วงกลม (`setCircle`) เฉพาะลำต้น/พุ่มใบชั้นใน ไม่รวม leaf พุ่มไกลสุด | รัศมี ~55-60% ของ canopy |
| `obstacle_wall.svg` | สี่เหลี่ยมยาว (`setSize`) | ให้สูง/กว้างตรงแถบกำแพงจริง ไม่รวมเงา ellipse ด้านล่าง |
| `obstacle_house.svg` | สี่เหลี่ยม ตรงตัวบ้าน (ไม่รวมหลังคาที่ยื่นเฉียง) | ใช้กรอบผนังตึกเป็นหลัก |
| `obstacle_camp_tent.svg` | สามเหลี่ยม/สี่เหลี่ยมแคบ ตรงฐานเต็นท์ | ให้แคบกว่าเงาเต็นท์ |

**ทั่วไป**: ทุกชิ้นต้องเซ็ต `body.setOffset(x, y)` ให้ hitbox อยู่กึ่งกลางภาพจริง ไม่ใช่กึ่งกลาง texture bounding box เต็ม (ที่มักมี padding โปร่งใส/เงาอยู่รอบๆ ทำให้ hitbox เยื้อง/ใหญ่เกิน) ทดสอบด้วยการเปิด `physics.debug = true` ชั่วคราวเทียบ hitbox กับภาพจริงทีละชิ้นก่อนปิด debug กลับ

---

## 2. ระบบ VIP จาก Exp การผ่านด่าน — ฟีเจอร์ใหม่ทั้งหมด

VIP เก็บจาก **Exp ที่ได้จากการผ่านด่านเท่านั้น** (`rewardExp` ที่ตั้งไว้ใน sheet `Stage` อยู่แล้ว) ไม่เกี่ยวกับเลเวลตัวละครหรือ exp อื่น เก็บสะสมเป็น `vipExp` แยกต่างหากใน `Players`

ตารางค่า Exp ที่ต้องใช้เพื่อขยับ VIP level ถัดไป (ใช้แต้มสะสมไปแลก ไม่ใช่ threshold คงค้าง — หักออกจากยอดสะสมทุกครั้งที่อัพเลเวล หรือจะเก็บเป็น cumulative threshold ก็ได้ ขอแค่ผลลัพธ์ตรงตามตารางนี้):

| จาก VIP | ไป VIP | ใช้ Exp |
|---|---|---|
| 0 | 1 | 500 |
| 1 | 2 | 1,000 |
| 2 | 3 | 1,500 |
| 3 | 4 | 2,000 |
| 4 | 5 | 2,500 |
| 5 | 6 | 3,000 |
| 6 | 7 | 3,500 |
| 7 | 8 | 4,000 |
| 8 | 9 | 4,500 |
| 9 | 10 | 5,000 |

- สร้าง sheet `VipConfig` (level, expRequired) seed ตามตารางนี้
- ทุกครั้งที่ผ่านด่าน (`/api/game/complete`) บวก `vipExp` เพิ่ม แล้วเช็คว่าเลื่อน VIP level ได้หรือยัง (auto level-up ทันทีที่ถึงเกณฑ์ ไม่ต้องกดยืนยัน)
- แสดง VIP level + progress bar ไป level ถัดไปในหน้า Home/Setting (จุดที่เหมาะสม)
- **VIP5 ใช้เป็นเงื่อนไขปลดล็อก Azzure ตามที่ระบุไว้ใน v2 ข้อ 3 อยู่แล้ว** ตอนนี้มีสูตรคำนวณ vipExp จริงแล้ว ให้เช็ค `vipLevel >= 5` จากค่านี้ได้เลย

### รางวัล VIP10

เมื่อถึง VIP10 (ครั้งแรกเท่านั้น, one-time) → แจก **แบงค์เขียว 100 ใบทันที** เข้า `PlayerIncome.greenBanknoteBalance` (ตามระบบ Income ที่ทำไว้ใน v4 ข้อ 5) ซึ่งแลกเป็นเงินจริงได้ 100 บาทตามอัตรา 1 ใบ = 1 บาทที่กำหนดไว้แล้ว (คำเตือนเรื่อง manual payout/กฎหมายเดิมจาก v4 ยังใช้อยู่)

---

## 3. เว็บช้าทุกจุดที่มีการเขียน Sheet (ซื้อของ, อัปเกรด, กาชา, สลับอาวุธ/ตัวละคร)

**คำตอบตรงๆ: ใช่ สาเหตุหลักคือการใช้ Google Sheets เป็นฐานข้อมูลหลักของเกม** Google Sheets API ไม่ได้ถูกออกแบบมาให้เป็น real-time transactional database — ทุกการกดซื้อ/อัปเกรด/กาชา ต้องทำ round-trip ไปเซิร์ฟเวอร์ Google อย่างน้อย 1 read + 1 write (บางที 2-3 ครั้งถ้าต้องเช็คหลาย sheet) ซึ่งช้ากว่าฐานข้อมูลจริงมาก (Sheets API มี latency ปกติ 300ms-1s+ ต่อ request เทียบกับ database จริงที่ <50ms) ยิ่งรวมกับ quota limit ที่เจอในข้อ v8 ยิ่งทำให้แย่ลงไปอีก

**แนวทางแก้ (เรียงจากทำง่าย/เร็ว ไปทำใหญ่/ยั่งยืน):**

1. **Optimistic UI ทุกปุ่มกด** (ซื้อ/อัปเกรด/กาชา/สลับอาวุธ): อัปเดตหน้าจอทันทีที่กดปุ่ม (สมมุติว่าสำเร็จ) แล้วค่อยยิง API ไป background, ถ้า API fail ค่อย rollback UI — ผู้เล่นจะรู้สึกว่าเร็วขึ้นทันทีแม้ backend ยังช้าอยู่เท่าเดิม (แก้ perceived performance ก่อน)
2. ใช้ cache + batchGet + invalidate เฉพาะจุดตามที่ระบุไว้แล้วใน v8 ข้อ 1 ให้ครบ (ลด read ให้เหลือน้อยที่สุดก่อนเขียน)
3. เขียนแบบ **fire-and-forget สำหรับ non-critical writes** (เช่น log/analytics) แยกจาก write ที่ critical (เงิน/ไอเทม) ที่ต้อง await จริง
4. **แนวทางระยะยาวที่แนะนำจริงๆ (ถ้าต้องการให้เกมลื่นจริงระดับ production):** ย้ายฐานข้อมูล runtime ไปใช้ database จริง (เช่น Supabase/Postgres, PlanetScale, หรือ Firebase) แล้วให้ Google Sheets เป็นแค่ "หน้าต่างแก้ไข config" (Characters, Weapons, Equipment, Stage ฯลฯ ที่ผู้ใช้อยากแก้เองได้) ที่ sync เข้า database จริงเป็นรอบๆ (เช่น cron sync ทุก 5-10 นาที หรือกดปุ่ม "sync from sheet" เอง) ส่วนข้อมูลผู้เล่น (Players, PlayerWeapon, PlayerEquipment ฯลฯ) ที่ต้อง read/write ถี่มากให้อยู่ใน database จริงล้วนๆ ไม่ผ่าน Sheets เลย — งานนี้ใหญ่กว่าเดิมมาก ให้เสนอเป็นแผนแยกถ้าผู้ใช้ต้องการทำจริงจัง (ไม่บังคับต้องทำในรอบนี้ แต่ควรรู้ไว้เป็นทางเลือกถ้าหลัง deploy จริงแล้วยังช้าเกินรับได้)

---

## 4. Reset test account + ลบ user เก่าทั้งหมดทุกครั้ง (แก้จาก v7/v8)

แก้ `scripts/reset-test-account.ts` เพิ่มเติม:
- ก่อนสร้างบัญชีทดสอบใหม่ ให้ **ลบ row ผู้เล่นเก่าทั้งหมด** ใน sheet `Players` (ไม่ใช่แค่บัญชีเดียว — ลบทุก row ที่เป็นบัญชีทดสอบ/ไม่ใช่บัญชีจริงของผู้เล่นทั่วไป ถ้ามีระบบแยก `isTestAccount` flag ให้ลบเฉพาะที่ flag นี้เป็น true เพื่อไม่พลาดลบบัญชีคนอื่น) รวมถึงลบ row ที่เกี่ยวข้องใน `PlayerWeapon`, `PlayerEquipment`, `PlayerCharacter`, `PlayerStageProgress`, `PlayerWeaponAmmo`, `PlayerPassive`, `PlayerMission`, `PlayerIncome`, `PlayerBossProgress` ของบัญชีเหล่านั้นด้วย
- สร้างบัญชีใหม่ให้เลย พร้อม print user/password ตามที่ทำไว้แล้วใน v7 ข้อ 1
- ยังคงกติกาจาก v6/v7: เงิน/เพชร/ticket ตั้งเป็นค่าสูงมาก (unlimited), ไม่ auto-grant ตัวละคร/อาวุธพิเศษ (นอกจาก starter ปกติที่ผู้เล่นใหม่ทุกคนได้)

---

## 5. Rocket Launcher จรวดยังเป็นแนวนอนคงที่ (บั๊กเดียวกับ Rasor gun ในข้อ 9 ของ v8)

**Root cause ของทั้ง Rasor gun และ Rocket Launcher คือจุดเดียวกัน:** โค้ดสร้างกระสุน (bullet spawn) ไม่ได้ตั้งค่า `rotation`/`angle` ของ sprite ตามทิศทางการยิงจริงเลย ไม่ว่าอาวุธไหน ให้แก้ที่จุดกลางจุดเดียวใน `Player.ts`/`GameScene.ts` (ฟังก์ชัน spawn bullet ทั่วไปที่ทุกอาวุธเรียกใช้ร่วมกัน) ไม่ใช่แก้ทีละอาวุธแยกกัน:

```ts
const angle = Phaser.Math.Angle.Between(fromX, fromY, targetX, targetY);
bullet.setRotation(angle); // หรือ bullet.rotation = angle
```

**ข้อกำหนดสำคัญ**: sprite กระสุนทุกชนิดต้องวาดโดยให้ "หัว"/ทิศพุ่งไปทาง **ขวา (+X)** เป็นทิศตั้งต้นเสมอ (rotation 0 = ชี้ขวา) เพื่อให้สูตรข้างบนใช้ได้ตรงกับทุก asset — `bullet_rocket.svg` แก้ให้หัวจรวดชี้ขวาแล้วในรอบนี้ (ดูหัวไฟล์), `bullet_razor.svg` ที่แก้เองไว้ก็เป็นแนวนอนอยู่แล้ว (ตรงกับ convention นี้พอดี) — เช็ค `bullet_round.svg` และ `bullet_grenade.svg` ด้วยว่าไม่จำเป็นต้องหมุนก็ไม่กระทบ (กลมไม่มีทิศ) แต่ยังต้อง apply rotation ให้ครบทุกกระสุนเผื่ออนาคตเปลี่ยน asset เป็นทรงมีทิศ

---

## 6. Deploy ขึ้น Vercel ได้ไหม + รองรับมือถือด้วยจอยควบคุม

### Vercel

**ตอบ: deploy ได้เลย** โปรเจกต์เป็น Next.js อยู่แล้วซึ่ง Vercel รองรับเป็น first-party (deploy ง่ายสุดในบรรดา hosting ทั้งหมดสำหรับ Next.js) สิ่งที่ต้องเตรียมก่อน deploy จริง:
1. ตั้งค่า environment variables ใน Vercel Project Settings ให้ครบ (NEXTAUTH_SECRET, NEXTAUTH_URL เป็น domain จริง, Google service account credentials — **ห้ามอัป `credentials.json` ขึ้น repo/Vercel ตรงๆ** ให้แปลงเนื้อหาไฟล์เป็น env var เดียว เช่น base64-encode แล้วอ่านค่ากลับตอน runtime แทน)
2. เช็คว่าไม่มีจุดไหนใน API route ใช้เวลานานเกิน Vercel serverless function timeout ของ plan ที่ใช้ (free tier ปกติ 10 วินาที) — ถ้า Sheets API ช้าตามข้อ 3 ด้านบนอาจชนขีดนี้ได้ ให้แก้ perf ก่อน deploy จริงจะปลอดภัยกว่า
3. Phaser/Canvas รันฝั่ง client อยู่แล้วในโปรเจกต์นี้ (dynamic import ใน `GameClient.tsx`) ไม่มีปัญหากับ Vercel (ไม่ใช่ SSR)
4. เพิ่ม `vercel.json` เฉพาะถ้าต้องการ custom config (region ใกล้ผู้ใช้ เช่น `sin1` สิงคโปร์ เพื่อ latency ต่ำสุดสำหรับผู้เล่นไทย)

### รองรับมือถือ + จอยควบคุมเสมือน (เฉพาะโทรศัพท์เท่านั้น)

เพิ่ม virtual joystick overlay เฉพาะเมื่อ detect ว่าเป็นอุปกรณ์ touch/มือถือจริง (เช็ค `('ontouchstart' in window) && window.innerWidth < 768` หรือ user-agent) — **ไม่แสดงบน desktop เด็ดขาด**:

- ใช้ไลบรารี `nipplejs` (`npm install nipplejs`) หรือเขียน custom touch handler ใน Phaser scene เอง
- **จอยเคลื่อนที่**: มุมซ้ายล่างของจอ ควบคุมทิศทางเดินของตัวละคร (mapping ทิศ joystick → WASD-equivalent velocity)
- **จอยเล็ง**: มุมขวาล่างของจอ ลากทิศไหนตัวละครหันปืนไปทิศนั้น (ยิงอัตโนมัติตามทิศที่เล็งถ้าปุ่มยิงถูกกดค้าง หรือแค่กำหนดทิศไว้เฉยๆ ก็ได้แล้วแต่ design)
- **ปุ่มยิง**: อยู่เหนือจอยเล็ง (มุมขวาล่างเช่นกัน แต่ตำแหน่งสูงกว่าจอยเล็งเล็กน้อย ไม่ทับกัน) กดค้างเพื่อยิงต่อเนื่อง
- ปรับ `HUDScene.ts`/`GameClient.tsx` ให้ layout เมื่อ mobile: ย่อขนาด HUD อื่นๆ (ammo, HP, shield, minimap) ให้ไม่บังพื้นที่จอย, รองรับ responsive canvas ที่ resize ตาม viewport มือถือ (`Phaser.Scale.FIT` หรือ `RESIZE` mode แทนขนาด fixed 960x540 เดิม)

---

## ลำดับความสำคัญที่แนะนำสำหรับรอบนี้

1. Fix bullet rotation จุดเดียว (ข้อ 5) — ง่ายและกระทบหลายอาวุธพร้อมกัน
2. Fix hitbox สิ่งกีดขวางแบบละเอียดต่อชิ้น (ข้อ 1)
3. Perf: optimistic UI + cache/batch (ข้อ 3 ข้อย่อย 1-3) — ก่อนพิจารณาย้าย DB จริง
4. ระบบ VIP + รางวัล VIP10 (ข้อ 2)
5. Reset script ลบ user เก่าทั้งหมด (ข้อ 4)
6. เตรียม deploy Vercel (ข้อ 6 ส่วนแรก) + mobile joystick controls (ข้อ 6 ส่วนหลัง)
