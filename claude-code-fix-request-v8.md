# Military Shooter 2D — Master Change Request v8 (ต่อยอดจาก v2-v7)

v2-v7 ยังใช้ได้ทั้งหมด ไฟล์นี้แก้/เพิ่มเฉพาะเรื่องด้านล่าง

Asset ใหม่: `public/assets/sprites/ui/gacha_capsule_ticket.svg` (แคปซูลกาชา ticket โทนทองคำ แยกจากแคปซูลเดิม `shop_gacha_capsule.svg` ที่ให้ใช้กับกาชาเพชรต่อไปตามเดิม)

---

## 1. Error: Google Sheets API Quota Exceeded (สำคัญมาก — กระทบทั้งระบบ)

```
Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'
at readSheetRaw (src/lib/google/sheet.ts:32:15)
at fetchFresh (src/lib/google/cache.ts:17:29)
at getAllPlayers (src/lib/google/player.ts:64:20)
```

Root cause: ระบบอ่าน sheet ตรงๆ (`sheets.spreadsheets.values.get`) บ่อยเกินไปจนชน quota เริ่มต้นของ Google (ปกติ 60 read requests/นาที/user) เพราะ cache ที่มีอยู่ใน `cache.ts` อาจไม่ได้ผลจริง (เช่น cache ถูกสร้างใหม่ทุก request ใน serverless/dev environment แทนที่จะ persist ข้ามการเรียก) ให้แก้ดังนี้:

1. **ตรวจสอบว่า cache instance เป็น singleton จริง** ข้าม request ทั้งหมด (ใน Next.js dev mode ต้องระวังเรื่อง module ถูก re-instantiate ตอน hot reload — ใช้ `globalThis` เก็บ cache instance กันปัญหานี้ เช่น `globalThis.__sheetCache ??= new Map()`)
2. **เพิ่ม TTL ของ cache** จาก 60 วินาทีเป็นอย่างน้อย 120-300 วินาทีสำหรับ sheet ที่ไม่เปลี่ยนบ่อย (Characters, Weapons, Equipment, Stage, PassiveConfig, GachaConfig) เพราะข้อมูลพวกนี้แทบไม่เปลี่ยนระหว่างวัน ต่างจาก `Players` ที่เปลี่ยนบ่อยกว่า (แยก TTL ตาม sheet ได้)
3. **ใช้ `spreadsheets.values.batchGet`** แทนการยิง `.get()` แยกทีละ sheet เมื่อหน้าเดียวต้องอ่านหลาย sheet พร้อมกัน (เช่นหน้า home อ่าน Players + Characters + Weapons + Quest ในการโหลดครั้งเดียว) เพื่อลดจำนวน API call ต่อการโหลด 1 หน้า
4. **เพิ่ม retry + exponential backoff** ใน `readSheetRaw` เมื่อเจอ error 429 quota exceeded (retry 2-3 ครั้ง ห่างกัน 500ms/1s/2s) แทนที่จะโยน error ตรงๆ ให้หน้าเว็บพัง
5. พิจารณาไปที่ Google Cloud Console → APIs & Services → Quotas → ขอเพิ่ม quota "Read requests per minute per user" ของ Sheets API ให้สูงขึ้น (ค่า default ค่อนข้างต่ำสำหรับเกมที่มีการอ่านบ่อย) — เป็นการแก้ที่ฝั่ง infra ควบคู่ไปกับการลด read requests ในโค้ด
6. เช็คจุดที่อ่านซ้ำโดยไม่จำเป็นในทุกหน้า (home, play, character, inventory) ว่ามีการเรียก `getAllPlayers()`/`getAllCharacters()` ฯลฯ ซ้ำหลายครั้งในการโหลดหน้าเดียวหรือไม่ (เช่น เรียกใน layout ด้วยและใน page ด้วยอีกที) ให้รวมเป็นจุดเดียว

---

## 2. Reset test account ยังไม่รี stage ให้จริง (ยังค้างอยู่ที่ด่าน 2)

บั๊กนี้เกี่ยวโยงกับข้อ 1 (อาจเป็นเพราะ cache เก่าที่ยังไม่หมดอายุ serve ค่า `stagesCleared` เดิมอยู่ ทั้งที่ sheet ถูกเขียนใหม่แล้วจริง) ให้ตรวจ 2 จุด:
1. `scripts/reset-test-account.ts` เขียนค่า `stagesCleared = 0` / ล้าง `PlayerStageProgress` ลง sheet จริงหรือไม่ (log ค่าที่เขียนออกมาด้วยเพื่อ verify)
2. หลังรันสคริปต์ ให้ **invalidate cache ของ sheet `Players`/`PlayerStageProgress` ทันที** (เคลียร์ entry ใน cache map ที่เกี่ยวข้อง ไม่ใช่รอ TTL หมดอายุเอง) ไม่งั้นต่อให้เขียน sheet ถูกต้อง หน้าเว็บก็ยังอ่าน cache เก่าที่บอกว่าผ่านด่าน 1 ไปแล้วอยู่ดี

---

## 3. อธิบาย + แก้ไข: ค่าสถานะอัปเกรดของหมวก/เกราะ/รองเท้า ไม่โชว์เปอร์เซ็นต์

ที่ทำไปตาม v6 ข้อ 2/4 (แสดงโบนัสต่อชิ้นใน stat panel) ยังไม่ถูก implement ครบ — เช็คให้แน่ใจว่า UI ดึงค่าจาก `Equipment` sheet (rarity bonus ตามตาราง v3) **บวกกับ** `PlayerEquipmentLevel.upgradeLevel x dupeBonusPerLevel` (ตามตาราง dupe-upgrade ใน v3) มาคำนวณรวมแล้วแสดงจริง ไม่ใช่แค่โชว์ชื่อ rarity เฉยๆ โดยไม่มีตัวเลข % ต่อท้าย

## 3.1 คำอธิบาย: "อัตราเกราะ%" คืออะไร (ตอบคำถามผู้ใช้)

**อัตราเกราะ% (armor%) เป็นสเตตัสของตัวละครเอง** (กำหนดไว้ใน sheet `Characters` ตามตาราง v2 ข้อ 3 เช่น Bob +0%, Jackson +10%, Ryzor +20% ฯลฯ) ความหมายคือ **ลดความเสียหายที่ได้รับจากศัตรู** (damage reduction) เช่น armor 20% = โดนดาเมจจริงแค่ 80% ของค่าที่ควรโดน

**หมวก/เกราะ/รองเท้า (equipment) ตามตารางที่กำหนดไว้ใน v3/v6 ไม่ได้ให้ค่า armor% เลย** — equipment ให้แค่ HP%, ATK%, CritChance%, CritDamage% (+ Shield แบบ v5) เท่านั้น ตามที่ผู้ใช้ระบุไว้เอง เป็นการดีไซน์ที่ตั้งใจแยกกัน (armor% มาจากตัวละครเท่านั้น, equipment เน้น HP/ATK/Crit/Shield) — **ไม่ใช่บั๊ก ไม่มีอะไรต้องแก้ตรงนี้** เว้นแต่ผู้ใช้ต้องการเพิ่ม armor% ให้ equipment บางชิ้นด้วยในอนาคต (ถ้าต้องการให้แจ้งมาเพิ่มทีหลัง)

---

## 4. แคปซูลกาชา Diamond vs Ticket ต้องหน้าตาต่างกัน

- **กาชาเพชร**: ใช้ `shop_gacha_capsule.svg` เดิม (แคปซูลแดง-ขาว) ไม่ต้องเปลี่ยน
- **กาชา ticket**: เปลี่ยนไปใช้ `gacha_capsule_ticket.svg` ที่สร้างใหม่ให้แล้ว (โทนทองคำ มีดาวประดับ) — แก้ `GachaClient.tsx` ให้เลือก capsule sprite ตาม pool ที่กำลังเปิดอยู่ (diamond pool vs ticket pool)

---

## 5. เพิ่มด่านให้ครบ 10 ด่าน (ตอนนี้มีแค่ 5)

เพิ่ม stage เข้า sheet `Stage` (และ `scripts/init-sheets.ts`) ให้ครบ 10 ด่านทั่วไป (เพิ่มอีก 5 ด่านจากที่มีอยู่) โดยยังใช้กติกาความยาก/enemy spawn เดิม แค่เพิ่มจำนวนด่าน — ผังแมพจริงของด่านใหม่ 5 ด่านนี้ให้ใช้ placeholder (เช่น สลับ background/enemy count จากด่าน 1-5 ไปพลางๆ) ผู้ใช้จะออกแบบแมพจริงเองทีหลังตามที่ระบุไว้ใน v2 ข้อ 8 — ตอนนี้แค่ต้องมี 10 ด่านให้เดินหน้าได้ก่อน (สำคัญเพราะ boss stage ในข้อ v4 ผูกกับ "ทุก 10 ด่าน" ต้องมีด่านครบ 10 ก่อนถึงจะทดสอบบอสได้)

---

## 6. กระสุนหมดต้องขึ้น "OUT OF AMMO" ไม่ใช่พยายามรีโหลดวนไป

บั๊ก: ตอนนี้เมื่อกระสุนสำรอง (dailyAmmo) หมด ระบบยังพยายาม auto-reload วนไปเรื่อยๆ แทนที่จะหยุด — แก้ที่ logic การยิง/รีโหลดใน `Player.ts`/`GameScene.ts`:
- เช็คว่า `remainingDailyAmmo <= 0` **และ** แม็กในมือ (magazine) หมดพร้อมกัน → ห้าม trigger reload อีก, แสดงข้อความ **"OUT OF AMMO"** กลางจอ/เหนือ HUD กระสุน (สีแดง เด่นชัด) จนกว่าจะเติมกระสุนสำเร็จ (ผ่านโฆษณา/จ่ายเพชรตาม v7 ข้อ 3) หรือจนจบด่าน
- ปุ่มยิง (mouse/spacebar) ต้องถูก disable หรือไม่มีผลใดๆ เมื่ออยู่ในสถานะนี้ (ป้องกันบั๊กข้อ 7 ด้านล่างด้วย)

---

## 7. โหมดฟาร์ม: ตายแล้วยัง respawn ได้ + บั๊กยิงกระสุนไม่อั้นตอนกระสุนหมด

สองบั๊กที่ต้องแก้พร้อมกัน:
1. **Permadeath ต้องบังคับใช้ในด่านฟาร์มด้วย** (ตาม v6 ข้อ 6 ที่ตั้งใจให้ใช้ทุกโหมดรวมถึงฟาร์ม) ตอนนี้ด่านฟาร์มยังปล่อยให้ respawn ได้อยู่ — แก้ให้ตายปุ๊บจบ session ฟาร์มทันที (`GameOverScene` ขึ้น พร้อมสรุปว่าฟาร์มถึง wave ไหนแล้ว) ต้องกด "เล่นใหม่" เพื่อเริ่ม wave 1 ใหม่เท่านั้น ห้ามมี logic respawn กลาง wave หลงเหลือ
2. **บั๊กยิงกระสุนไม่จำกัดตอนกระสุนหมด** — คือ root cause เดียวกับข้อ 6 (ไม่มีการเช็ค ammo ก่อนอนุญาตให้ยิง) ให้แก้จุดเดียวกัน (guard condition ก่อนเรียก fire function ทุกจุดที่เกี่ยวข้อง ทั้งด่านทั่วไปและด่านฟาร์ม)

---

## 8. ตกแต่งหน้า Home ให้สวยขึ้น

หน้า `home/page.tsx`/`HomeClient.tsx` ตอนนี้เรียบไป ให้ปรับใหม่ (ดูข้อ 11 เรื่อง reskin ทั้งเว็บด้วย เพราะ Home เป็นหน้าแรกที่ควรทำสไตล์ตั้งต้น):
- แสดงตัวละครที่ equip อยู่เป็นภาพใหญ่ (ใช้ sprite ที่มี) พร้อมพื้นหลังธีมทหาร/สนามรบ (ใช้ `battlefield_ground.svg` เป็น background แบบเบลอ/มืดลงหน่อยไม่ให้แย่งโฟกัส)
- แถบสถานะเงิน/เพชร/ticket แสดงชัดเจนมุมบน พร้อมไอคอนประกอบ
- ปุ่มเมนูหลัก (Play, Character, Inventory, Gacha, Shop, Mission, ฯลฯ) จัดเป็น grid card สวยงามมี icon แทนปุ่มตัวหนังสือเรียบๆ

---

## 9. Rasor Gun ยิงกระสุนแนวนอนตลอด ต้องหมุนตามทิศทางยิงจริง + เปลี่ยนภาพ

บั๊ก: กระสุน Rasor gun เรนเดอร์แนวนอนคงที่ ไม่หมุนตามทิศที่ยิงออกไป (มุม rotation ของ sprite ไม่ผูกกับ velocity/ทิศทางจริง) — แก้ใน `Player.ts`/`GameScene.ts` จุดสร้างกระสุน: ตั้ง `bullet.rotation = Phaser.Math.Angle.Between(fromX, fromY, toX, toY)` (หรือ `angle` ตาม velocity vector) ทุกครั้งที่ spawn กระสุน Rasor gun เพื่อให้เส้นชี้ไปทิศทางที่ยิงจริงเสมอ

เปลี่ยนภาพกระสุน Rasor gun เป็น **เส้นสีฟ้าเรืองแสงเล็กๆ** (ไม่ใช่สีฟ้าอมเขียวแบบเดิม) — แก้ `bullet_razor.svg` เป็นโทนสีฟ้าสว่างเรืองแสงชัดเจนขึ้น (เพิ่ม glow gradient รอบเส้น)

---

## 10. รัศมีระเบิด Grenade Launcher ต้องเล็กกว่า Rocket Launcher 2 เท่า

กำหนดค่า AoE radius ใน sheet `Weapons`/config: ถ้า Rocket Launcher มีรัศมีระเบิด = R ให้ Grenade Launcher มีรัศมี = R / 2 เพิ่ม column `explosionRadius` ในสองแถวนี้ถ้ายังไม่มี แล้วตั้งค่าตามอัตราส่วนนี้

## 11. ดาเมจ Splash (โดนขอบวงระเบิด ไม่ตรงจุด) ต้องคิดดาเมจด้วย

ตอนนี้ AoE ของ Rocket/Grenade อาจจะคิดดาเมจแค่เป้าที่โดนตรงจุดระเบิดเท่านั้น (จุดศูนย์กลาง) ให้แก้เป็น:
- เป้าหมายที่อยู่ **ตรงจุดกระทบโดยตรง** → ได้ดาเมจเต็ม 100% ตามค่าอาวุธ
- เป้าหมายอื่นที่อยู่ **ในรัศมีวงระเบิดแต่ไม่ได้โดนตรงจุด** → ได้ดาเมจ **60% ของดาเมจเต็ม** (splash damage)
- Implement ด้วยการหา `distance` จากจุดระเบิดไปยังศัตรูแต่ละตัวที่อยู่ใน `explosionRadius`, ถ้า `distance` เกือบ 0 (โดนตรง) ให้ full damage, ถ้าอยู่ในรัศมีแต่ไม่ใช่จุดตรง (เช็คง่ายๆ คือทุกตัวใน radius ที่ไม่ใช่เป้าที่ bullet ชนโดยตรง) ให้ 60% เสมอ (ไม่ต้อง scale ตามระยะห่างในรัศมีให้ซับซ้อน แค่ 2 ระดับพอตามที่ผู้ใช้ระบุ)

---

## 12. Reskin ทุกหน้าในเกมให้สไตล์เดียวกับหน้า Character (ผู้ใช้ชอบมาก)

ผู้ใช้พอใจกับสไตล์หน้า character (การ์ดตัวละครพร้อมพื้นหลังไล่เฉดสีตามธีม, glow border ตอนเลือก) จาก v7 ข้อ 5 — ให้ดึงสไตล์นี้มาทำเป็น **shared design system** แล้วใช้ทั้งเว็บ:

1. สกัด token สี/ธีมจากหน้า character ปัจจุบันออกมาเป็น Tailwind theme หรือ CSS variables กลาง (เช่น `military-green`, `military-darker`, `military-steel` ที่มีอยู่แล้วใน `tailwind.config.ts` + เพิ่มธีม accent gradient ต่อ rarity/rank ที่ใช้ในหน้า character)
2. สร้าง shared component (เช่น `<ThemedCard>`, `<ThemedPageBackground>`) ที่ใช้ gradient พื้นหลัง + glow border + typography เดียวกับหน้า character
3. นำ component เหล่านี้ไปแทนที่ layout เดิมในทุกหน้า: Home, Gacha, Shop, Mission, Leaderboard, Mail Box, Income, Setting, Inventory, Play (stage select) — ให้หน้าตาเป็นชุดเดียวกันทั้งเว็บ ไม่ปนสไตล์เก่า-ใหม่

---

## ลำดับความสำคัญที่แนะนำสำหรับรอบนี้

1. Google Sheets quota exceeded (ข้อ 1) — บล็อกทั้งเว็บใช้งานไม่ได้เลยตอนนี้
2. Reset stage ไม่ทำงานจริง (ข้อ 2) — ผูกกับข้อ 1
3. บั๊กยิงไม่อั้น + ammo หมดไม่หยุด + respawn ฟาร์ม (ข้อ 6, 7) — กระทบ core gameplay/บาลานซ์เศรษฐกิจ
4. Splash damage + explosion radius (ข้อ 10, 11) + Rasor gun rotation (ข้อ 9)
5. เพิ่มด่านให้ครบ 10 (ข้อ 5)
6. อัปเกรด equipment แสดง % จริง (ข้อ 3) + gacha capsule แยกแบบ (ข้อ 4)
7. Reskin ทั้งเว็บ (ข้อ 12) + ตกแต่ง Home (ข้อ 8)
