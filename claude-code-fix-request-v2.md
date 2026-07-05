# Military Shooter 2D — Master Change Request for Claude Code

หมายเหตุ: ไฟล์นี้ **แทนที่/ต่อยอด** `claude-code-fix-request.md` เดิมทั้งหมด (บั๊กเดิมยังต้องแก้ตามนั้น แต่สเปกใหม่ในไฟล์นี้ละเอียดกว่าและมาทีหลัง ให้ยึดไฟล์นี้เป็นหลักถ้าขัดกัน) ทุก asset ที่อ้างถึงด้านล่าง **สร้างไว้ให้แล้ว** อยู่ใน `public/assets/sprites/` พร้อมใช้งานทันที ไม่ต้องรอวาดใหม่

---

## 0. รีเซ็ตบัญชีทดสอบ (สำคัญ ทำก่อนอย่างอื่น)

บัญชีอีเมล `earth.noppanut@gmail.com` (แอดมิน/ผู้พัฒนา) ต้องถูกรีเซ็ตให้เหมือนผู้เล่นใหม่ 100%:

- เขียนสคริปต์ one-off (เช่น `scripts/reset-player.ts`, รันด้วย `tsx`) ที่:
  1. ค้นหา row ผู้เล่นใน sheet `Players` ด้วยอีเมลนี้
  2. รีเซ็ต: coin → ค่าเริ่มต้นจาก `ECONOMY_CONFIG.startingCoin`, diamond → `startingDiamond`, ticket → `startingTicket`, ammo/level/exp → ค่าเริ่มต้น, `currentCharacter` → `bob`, `currentWeapon` → `pistol`
  3. ลบ row ที่เกี่ยวข้องทั้งหมดใน `PlayerCharacter`, `PlayerWeapon`, `PlayerEquipment`, `Inventory` ที่ผูกกับ playerId นี้ ยกเว้นการเป็นเจ้าของ Bob + Pistol เริ่มต้น (สร้างใหม่ให้ 2 แถวนี้)
  4. ล้าง progress ด่าน (stage unlock กลับไปด่าน 1, farm stage wave กลับเป็น 0)
- รันสคริปต์นี้ 1 ครั้งตอนจบงานทั้งหมด แล้วลบสคริปต์ทิ้งได้ (หรือเก็บไว้เป็น dev tool ก็ได้ ใส่ safeguard กันรันมั่ว เช่น ต้องใส่ email ผ่าน CLI arg)

---

## 1. ใช้ Asset ภาพที่สร้างไว้แล้ว (สำคัญ — งานที่แล้วยังไม่ได้ถูกใช้จริง)

ไฟล์ทั้งหมดเป็น `.svg` วางไว้ใน `public/assets/sprites/` แล้ว Phaser 3 โหลด SVG ได้ตรงด้วย `this.load.svg(key, path, { width, height })` — ให้แก้ `src/game/scenes/PreloadScene.ts` เพิ่ม/แก้ key การโหลดทั้งหมดตามรายการนี้ แล้วตรวจว่าทุกที่ที่เคย reference sprite เก่า (`Player.ts`, `Enemy.ts`, `CoverObject.ts`, `GameScene.ts`, background ในแต่ละ stage) ถูกเปลี่ยนไปใช้ key ใหม่จริง (ไม่ใช่แค่โหลดแต่ไม่ได้เอาไปแสดง):

**ตัวละครผู้เล่น** (`public/assets/sprites/characters/`): `bob_private.svg`, `jackson_sergeant.svg`, `ryzor_lieutenant.svg`, `mina_captain.svg`, `azzure_colonel.svg`

**อาวุธ** (`public/assets/sprites/weapons/`): `pistol.svg`, `double_pistol.svg`, `m16a1.svg`, `m16a4.svg`, `shotgun.svg`, `ak47.svg`, `gatling.svg`, `sniper.svg`, `rocket_launcher.svg`, `grenade_launcher.svg`, `rasor_gun.svg`

**อุปกรณ์เสริม** (`public/assets/sprites/equipment/`): `helmet_common.svg`, `helmet_epic.svg`, `vest_common.svg`, `vest_epic.svg`, `boots_common.svg`, `boots_epic.svg`

**ศัตรู** (`public/assets/sprites/enemy/`): `enemy_pistol.svg`, `enemy_ak47.svg`, `enemy_sniper.svg`, `enemy_shotgun.svg`, `enemy_rocket.svg` (ตัวเก่า `soldier_enemy.svg` ลบทิ้งได้ ใช้ 5 ตัวใหม่แทน)

**สิ่งกีดขวาง** (`public/assets/sprites/tilemap/`): `cover_sandbag.svg`, `cover_crate.svg`

**พื้นหลัง** (`public/assets/sprites/background/`): `battlefield_ground.svg` (เป็น tileable pattern 512x512 ใช้ทำพื้นสนามรบได้เลย)

**UI** (`public/assets/sprites/ui/`): `shop_gacha_capsule.svg` (ไอคอนแคปซูลกาชาสำหรับหน้า Shop)

ทุก sprite ตัวละคร/ศัตรูออกแบบเป็นวงกลมมุมบน (top-down) ขนาดสัดส่วนเท่ากันอยู่แล้ว (viewBox 128x128, ตัว body รัศมี 34) — ตรงกับข้อ 7 ด้านล่างที่ต้องการให้ตัวละครกับข้าศึกไซส์เท่ากัน ไม่ต้อง scale เพิ่ม

---

## 2. แก้บั๊กเดิม: ซื้อของในร้านค้าไม่ได้

(รายละเอียดเดิมจาก v1 ยังใช้ได้ทั้งหมด) สรุปสั้น: `/api/shop/buy` ต้อง return ยอด coin/diamond/ticket ที่อัปเดตแล้ว, `ShopClient.tsx` ต้องอัปเดต state ทันทีไม่ต้อง reload, ต้องมี atomic-safe (ไม่หักเงินถ้ามอบไอเทมไม่สำเร็จ), เพิ่ม loading state กันกดซ้ำ

---

## 3. ระบบตัวละคร (Characters) — แทนที่ข้อมูลเดิมทั้งหมดใน sheet `Characters`

ลบข้อมูลตัวละครเก่าทิ้งทั้งหมด แทนด้วย 5 ตัวนี้เท่านั้น (แก้ `scripts/init-sheets.ts` seed data ให้ตรงตารางนี้เป๊ะๆ ผู้ใช้จะไปปรับค่าต่อเองใน Google Sheet ภายหลัง):

| id | ชื่อ/ยศ | ปลดล็อกด้วย | พลัง (ปัจจุบัน/max) | ความเร็ว (/10) | ความแม่นยำ | ฟื้นฟู | เกราะ% | คริติคอล% | ดาเมจคริ% | sprite key |
|---|---|---|---|---|---|---|---|---|---|---|
| bob | Bob พลทหาร | เริ่มต้นฟรี | 100/200 | 6 | +0% | +1/5s | +0% | +0% | +0% | bob_private |
| jackson | Jackson สิบตรี | 2,500 เหรียญ | 150/200 | 5 | +0% | +2/5s | +10% | +0% | +0% | jackson_sergeant |
| ryzor | Ryzor ร้อยโท | 500 เพชร | 120/200 | 7 | +20% | +2/5s | +20% | +5% | +100% | ryzor_lieutenant |
| mina | Mina ร้อยเอก | 199 ticket | 80/200 | 10 | +30% | +1/5s | +10% | +20% | +50% | mina_captain |
| azzure | Azzure พันเอก | 1,099 ticket + ต้องมี VIP5 ขึ้นไป + เล่นด่านฟาร์มถึง wave >15 | 200/200 | 80* | +50% | +5/5s | +50% | +20% | +150% | azzure_colonel |

*หมายเหตุ Azzure ความเร็ว 80/10 เกิน scale ปกติ (max คือ 10) — เป็นค่าที่ผู้ใช้ระบุมาตรงๆ ให้เก็บ raw value ไว้ในชีทตามนี้ แต่ในโค้ดที่แปลงเป็น move speed จริง (px/s) ให้คูณผ่านสูตรเดียวกับตัวอื่น (เช่น `moveSpeedPx = statSpeed * SPEED_MULTIPLIER`) โดยไม่ clamp ที่ 10 — ปล่อยให้มันเร็วกว่าปกติจริงตามที่ตั้งใจไว้ (ตัวละครลับ/end-game) ถ้า UI แสดงเป็น "x/10" ให้แสดงเลขจริงแม้จะเกิน 10 (เช่น "80/10") ไม่ต้อง cap ตัวเลขที่แสดง

VIP level: ถ้ายังไม่มีระบบ VIP ในโปรเจกต์ ให้เพิ่ม field `vipLevel` ใน sheet `Players` (คำนวณจากยอดเติมเงินสะสม หรือใส่เป็น manual field ที่แก้ได้จาก Google Sheet โดยตรงไปก่อน เดี๋ยวจะกำหนดสูตรคำนวณให้ภายหลัง)

Requirement การปลดล็อก Azzure ต้องเช็ค 3 เงื่อนไข AND กัน: มี ticket พอ, `vipLevel >= 5`, และ `farmStageMaxWave > 15` (เก็บ field นี้ใน `Players` หรือ `PlayerProgress`)

---

## 4. ระบบอาวุธ (Weapons) — แทนที่ข้อมูลเดิมทั้งหมดใน sheet `Weapons`

ลบอาวุธเก่าทิ้ง ใส่ 11 กระบอกนี้แทน:

| id | ชื่อ | ปลดล็อก/ราคา | ดาเมจ | อัตรายิง | รูปแบบยิง | ความแม่นยำ | ซอง | รีโหลด | คริ% | ดาเมจคริ% | กระสุน/วัน | sprite key |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pistol | Pistol | เริ่มต้นฟรี | 20 | 1/s | นัดเดียว | 50% | 8 | 5s | 8% | 300% | 80 | pistol |
| double_pistol | Double Pistol | ผ่านด่าน 10 | 20 | 2/s | นัดเดียว x2 | 50% | 16 | 5s | 8% | 300% | 80 | double_pistol |
| m16a1 | M16A1 | 1,500 เหรียญ | 15 | 5/s | นัดเดียว | 50% | 30 | 6s | 10% | 250% | 150 | m16a1 |
| m16a4 | M16A4 | 4,000 เหรียญ | 20 | 1 วงรอบ/s (3 นัดเส้นตรงรวด) | burst x3 เส้นตรง | 60% | 30 | 6s | 15% | 300% | 150 | m16a4 |
| shotgun | Shotgun | 15,000 เหรียญ | 20 | 1 วงรอบ/s (16 นัดกระจาย) | spread 16 นัด ±2° | 50% | 16 | 5s | 10% | 300% | 160 | shotgun |
| ak47 | AK47 | 150 เพชร | 30 | 4/s | นัดเดียว | 45% | 40 | 8s | 20% | 400% | 120 | ak47 |
| gatling | Gatling | 1,800 เพชร | 15 | 12/s | spread 12 นัด ±5° | 45% | 100 | 20s | 5% | 300% | 500 | gatling |
| sniper | Sniper | 399 ticket | 100 | 1/2s | นัดเดียว + เล็งด้วยเส้นเลเซอร์แดงยาว | 80% | 5 | 8s | 40% | 450% | 50 | sniper |
| rocket_launcher | Rocket Launcher | 899 ticket | 320 | 1/8s | นัดเดียว + ระเบิดเป็นวง (AoE) | 100% | 1 | 8s | 0% | 0% | 10 | rocket_launcher |
| grenade_launcher | Grenade Launcher | 899 ticket | 200 | 1/s | นัดเดียว + AoE วง + ยิงข้ามกำแพงได้ (arc/lob) | 100% | 6 | 15s | 0% | 0% | 60 | grenade_launcher |
| rasor_gun | Rasor Gun | 1,099 ticket | 30 | 8/s | นัดเดียว | 70% | 40 | 8s | 20% | 400% | 160 | rasor_gun |

### กลไกกระสุนรายวัน (ใหม่ทั้งหมด ยังไม่มีในโค้ด)

- แต่ละอาวุธมี "กระสุนที่ใช้ได้ต่อวัน" ตามตาราง เมื่อยิงหมด **หมดจริง ยิงเพิ่มไม่ได้จนกว่าจะเติม**
- เติมกระสุนได้ 2 ทาง (ต้องสร้างใหม่ทั้งคู่):
  1. ดูวิดีโอโฆษณา (ใช้ระบบ ads ที่มีอยู่แล้วใน `config/ads.ts` + `src/lib/ads-service.ts`) → เพิ่มกระสุนอาวุธนั้น +10% ของกระสุนรายวัน ต่อการดู 1 ครั้ง (จำกัดจำนวนครั้ง/วันตาม `ECONOMY_CONFIG.maxAdsPerDay` หรือแยก config ใหม่เฉพาะกระสุนอาวุธ)
  2. จ่าย 30 เพชร → เติมกระสุนอาวุธนั้นเต็ม 100% ของโควตารายวันทันที
- ต้องมี field เก็บ "กระสุนคงเหลือวันนี้ต่ออาวุธต่อผู้เล่น" ใน sheet ใหม่ `PlayerWeaponAmmo` (playerId, weaponId, remainingAmmo, lastResetDate) รีเซ็ตกลับเต็มโควตาทุกเที่ยงคืน (ใช้ pattern เดียวกับ `refreshDailyAmmo` ที่มีอยู่แล้วใน `/api/player/ammo`)

---

## 4.1 การครอบครองอาวุธ

ยึดตามที่ระบุไว้ในไฟล์เดิม (v1 ข้อ 2): ต้องมี sheet `PlayerWeapon` (playerId, weaponId, owned, equipped), API `/api/weapon/equip`, และหน้าเลือก/equip อาวุธ — ทำตามนั้นแต่ใช้ข้อมูลอาวุธชุดใหม่ 11 กระบอกด้านบน

---

## 5. หน้า Inventory / Equipment ใหม่ทั้งหมด (ดีไซน์ตามที่กำหนด)

รื้อหน้า inventory เดิม สร้างใหม่ตาม layout นี้:

- กลางจอ: รูปตัวละครที่กำลัง equip อยู่ (sprite key ตามตัวละครที่เลือก)
- มีเส้นโยง (connector line) จากตัวละครไปยัง 4 กรอบช่องที่ 4 มุมจอ:
  - **มุมซ้ายบน = อาวุธ**: กดเพื่อเปิดลิสต์อาวุธที่ครอบครอง หรือ**ลากอาวุธจากแถบ inventory ด้านล่างมาวางใส่ช่องนี้ได้ (drag & drop)**
  - **มุมขวาบน = หมวก (helmet)**
  - **มุมซ้ายล่าง = ชุดเกราะ (vest/armor)**
  - **มุมขวาล่าง = รองเท้า (boots)**
- แถบ Inventory ด้านล่างจอ: แสดงไอเทมทั้งหมดที่ผู้เล่นมี (อาวุธ + อุปกรณ์ทุกชิ้น) เป็น grid ลากออกไปใส่ช่องมุมที่ตรง slot ได้ (ลากอาวุธไปช่องหมวกไม่ได้ ต้อง validate slot type)
- Implementation แนะนำ: ใช้ HTML5 drag-and-drop API หรือไลบรารีเบา (เช่น `@dnd-kit/core`) ในหน้า React ปกติ (ไม่ใช่ใน Phaser canvas) เพราะหน้านี้เป็นหน้าจัดการก่อนเข้าเกม ไม่ใช่ระหว่างเล่น
- ทุกครั้งที่ equip เปลี่ยน ให้เขียนลง `PlayerWeapon`/`PlayerEquipment` ทันที (ไม่ต้องกดปุ่ม save แยก)
- ใช้ sprite จากข้อ 1 แสดงไอคอนแต่ละชิ้นในแถบ inventory และในช่อง 4 มุม

---

## 6. ระบบ Passive (อัปเกรดสถานะทั่วโลก ไม่ผูกกับตัวละคร/อาวุธตัวใดตัวหนึ่ง) — ฟีเจอร์ใหม่

เพิ่มหน้า/แท็บใหม่ "Passive" ใน equipment หรือ character page ก็ได้ ให้ผู้เล่นอัปเกรดค่าพื้นฐาน 8 อย่าง แต่ละอย่างมี 10 tier จ่ายเพิ่มขึ้นเรื่อยๆ:

| Passive | สกุลเงิน | ราคาต่อ tier (1→10) | โบนัสต่อ tier (1→10) |
|---|---|---|---|
| เปอร์เซ็นต์พลัง (HP%) | เหรียญ | 50, 150, 500, 1000, 2000, 3000, 5000, 10000, 25000, 50000 | +1%,+1%,+1%,+2%,+2%,+2%,+2%,+3%,+3%,+3% |
| อัตราคริติคอล | เพชร | 10, 50, 100, 200, 500, 1000, 2500, 5000, 10000, 25000 | +1%,+1%,+1%,+1%,+1%,+1%,+1%,+2%,+3%,+3% |
| ความแม่นยำ | ticket | 5, 10, 50, 100, 200, 300, 500, 1000, 1500, 2500 | +1%,+1%,+1%,+1%,+1%,+1%,+1%,+1%,+1%,+1% |
| โจมตี (damage%) | เหรียญ | 50, 150, 500, 1000, 2000, 3000, 5000, 10000, 25000, 50000 | +1%,+1%,+1%,+2%,+2%,+2%,+2%,+3%,+3%,+3% |
| ความเร็วรีโหลด | เหรียญ | 50, 150, 500, 1000, 2000, 3000, 5000, 10000, 25000, 50000 | +1%,+1%,+1%,+2%,+2%,+2%,+2%,+3%,+3%,+3% |
| ความเร็วในการยิง | เหรียญ | 50, 150, 500, 1000, 2000, 3000, 5000, 10000, 25000, 50000 | +1%,+1%,+1%,+2%,+2%,+2%,+2%,+3%,+3%,+3% |
| กระสุนรายวัน | ticket | 5, 10, 50, 100, 250, 500, 1000, 2000, 4000, 5000 | +10% ทุก tier |
| ดาเมจคริติคอล | เพชร | 10, 50, 100, 200, 500, 1000, 2500, 5000, 10000, 25000 | +5%,+5%,+5%,+5%,+10%,+10%,+10%,+10%,+20%,+20% |

Implementation:
- สร้าง sheet ใหม่ `PassiveConfig` (passiveId, tier, cost, currency, bonusPercent) — seed จากตารางบนใน `init-sheets.ts`
- สร้าง sheet `PlayerPassive` (playerId, passiveId, currentTier)
- API `/api/passive/upgrade` — เช็ค currency พอไหม, tier ปัจจุบัน < 10, หักเงิน, +1 tier
- ค่าที่ได้จาก passive เป็น **global multiplier** รวมเข้ากับ stat ตัวละคร+อาวุธ+equipment ตอนคำนวณใน `/api/game/start`

---

## 7. แมพ & บาลานซ์การต่อสู้

- แมพห้ามใหญ่เกินไป: ปรับ stage width/height ใน sheet `Stage` ให้เล็กลงจากปัจจุบัน (เช่นลดเหลือประมาณ 1280x720 ถึง 1600x900 ต่อด่าน แทนค่าปัจจุบันที่ใหญ่กว่านี้ — ปรับตามความเหมาะสมของ camera zoom ที่ `config/game.ts` กำหนดไว้ 960x540)
- ศัตรูต้องไซส์เท่ากับผู้เล่น: sprite ใหม่ทั้งหมด (ข้อ 1) ทำมาให้ขนาดเท่ากันแล้ว (viewBox 128x128 เท่ากันทั้งคู่) — ตรวจใน `Enemy.ts` ว่าไม่มีการ set scale ให้ enemy ใหญ่กว่า player อีก (ลบ scale factor เดิมที่ทำให้ตัวใหญ่ผิดปกติ)
- กระสุนเคลื่อนที่ช้า: หา bullet speed constant ใน `Player.ts`/`GameScene.ts` แล้วเพิ่มค่าความเร็ว (เช่น x1.5–x2 จากปัจจุบัน) ให้ยิงแล้วรู้สึกไวขึ้นชัดเจน

---

## 8. Flow ของด่าน: ด่านทั่วไป vs ด่านฟาร์ม

- **ด่านทั่วไป (story stage):** เล่นได้ครั้งเดียวต่อด่าน เมื่อผ่านด่านแล้ว **ห้ามกลับไปเล่นซ้ำอีก** (ล็อกถาวรหลังผ่าน ไม่ใช่แค่ unlock ด่านถัดไป) เงื่อนไขชนะ = ต้องกำจัดศัตรูในด่านให้หมดทุกตัว (ไม่ใช่แค่เดินถึง goalX เหมือนปัจจุบัน) — ต้องแก้ win condition ใน `GameScene.ts`/`/api/game/complete` ให้เช็ค `enemiesRemaining === 0` แทนหรือเพิ่มเข้าไปคู่กับเงื่อนไขเดิม
  - ต้องเพิ่ม field `completed` (boolean) ต่อ playerId+stageId ใน `PlayerCharacter`/progress sheet เพื่อ track ว่าผ่านแล้วหรือยัง แล้ว disable ปุ่มเล่นซ้ำใน `StageSelectClient.tsx` ถ้า `completed === true` (โชว์เป็น "ผ่านแล้ว" แทนปุ่ม PLAY)
  - แผนที่ของแต่ละด่านทั่วไปให้ใช้ของเดิมไปก่อน (ผู้ใช้จะออกแบบแมพเองทีหลัง) — งานตอนนี้แค่ปรับ mechanic ไม่ต้องเปลี่ยนแมพจริง
- **ด่านฟาร์ม (repeatable):** เล่นซ้ำได้ไม่จำกัด เป็นทางเดียวที่จะหาเงิน/ไอเทมหลังผ่าน story ครบ

### กลไก Wave ของด่านฟาร์ม (ใหม่ทั้งหมด)

- Wave 1: ปล่อยศัตรู 3 ตัว
- ทุกๆ 3 wave (wave 4, 7, 10, ...): จำนวนศัตรูที่ปล่อยพร้อมกัน +1 ตัว จากค่าฐาน 3
- ทุกครั้งที่ผ่าน 1 wave: ศัตรู wave ถัดไปได้ดาเมจ +10% และพลัง(HP) +10% สะสมไปเรื่อยๆ (compounding เช่น wave2 = wave1 x1.1, wave3 = wave2 x1.1 ...)
- ศัตรูที่มาในแต่ละ wave สุ่มจาก 5 ประเภทด้านล่าง (ข้อ 9)
- เก็บ `farmStageMaxWave` ต่อผู้เล่นไว้ใน sheet (ใช้เป็นเงื่อนไขปลดล็อก Azzure ข้อ 3 ด้วย)
- สร้าง sheet ใหม่ `StageWave` หรือคำนวณ wave scaling ด้วยสูตรใน backend เลยก็ได้ (ไม่จำเป็นต้องเก็บทุก wave ลง sheet เพราะเป็นสูตร generate ได้)

---

## 9. ศัตรู 5 ประเภท (ชุดแรก — จะเพิ่มทีหลัง ให้ทำโครงสร้างรองรับเพิ่มง่าย)

แทนที่ข้อมูล enemy เดิมใน sheet `Enemies` ด้วย 5 ตัวนี้ (ดาเมจเริ่มต้น = อ้างอิงค่าดาเมจของอาวุธที่ตัวเองถือจากตาราง weapon ข้อ 4 โดยตรง ไม่ใช่เลขแยก และต้องมีกลไกรีโหลดเหมือนผู้เล่น):

| id | ถืออาวุธ | HP เริ่มต้น | ดาเมจ | รางวัลเมื่อกำจัดได้ | sprite key |
|---|---|---|---|---|---|
| enemy_pistol | Pistol | 100 | = ดาเมจ pistol (20) | 1 เหรียญ | enemy_pistol |
| enemy_ak47 | AK47 | 150 | = ดาเมจ ak47 (30) | 2 เหรียญ | enemy_ak47 |
| enemy_sniper | Sniper | 180 | = ดาเมจ sniper (100) | 3 เหรียญ | enemy_sniper |
| enemy_shotgun | Shotgun | 300 | = ดาเมจ shotgun (20) | 5 เหรียญ | enemy_shotgun |
| enemy_rocket | Rocket Launcher | 250 | = ดาเมจ rocket_launcher (320) | 5 เหรียญ | enemy_rocket |

- ค่า HP/ดาเมจข้างบนคือ **ค่าเริ่มต้นสำหรับด่านฟาร์มเท่านั้น** (จะถูกคูณด้วย wave scaling ข้อ 8) — ด่านทั่วไป (story) ให้คงค่าคงที่ไม่ scale (ผู้ใช้จะกำหนดค่าต่อด่านเองทีหลังใน sheet)
- ต้อง implement reload behavior ให้ enemy เช่นเดียวกับผู้เล่น (ยิงตามอัตรายิง/ซองของอาวุธที่ถือ แล้วหยุดยิงช่วง reload ตามเวลาของอาวุธนั้น)
- โครงสร้างโค้ด (`Enemy.ts`, sheet `Enemies`) ต้องออกแบบให้เพิ่มประเภทศัตรูใหม่ในอนาคตได้ง่ายๆ แค่เพิ่ม row ใน sheet (ห้าม hardcode enemy type แยกทีละ if-else ยาวๆ ใน `Enemy.ts` — ให้ดึง config จาก weaponId ที่ enemy ถืออีกที)

---

## 10. ตัดหน้า/เมนูที่ไม่จำเป็นออก

โครงสร้างหลักที่ต้องเหลือ:
- **Flow หลักในเกม:** Home → Character/Weapon select (รวมกับ Passive) → Inventory/Equipment → Play (เลือกด่าน) → Game
- **เมนูรอง (secondary) ให้เหลือแค่ 5 อย่างนี้เท่านั้น:** Shop (กาชาอุปกรณ์: หมวก/เกราะ/รองเท้า — ใช้ `shop_gacha_capsule.svg`), Mission (รวม daily quest เดิมที่แยกหน้า `/daily` เข้ามาเป็นแท็บเดียวกับ personal mission), Leaderboard, Mail Box, Setting
- **ลบออก:** หน้า `/admin` (`src/app/admin/page.tsx` + `/api/admin/*`) ถ้าไม่ได้ใช้เป็น dev tool จริงจัง, หน้า `/daily` แยก (ย้าย logic ไปรวมใน Mission), ระบบ Redeem ที่ผูกกับ `Redeem` sheet ถ้าไม่มี UI ใช้งานจริงอยู่แล้ว (ตรวจสอบก่อนลบว่ามีที่ไหนเรียกใช้ ticket redeem อยู่หรือเปล่า ถ้าไม่มีลบ route+UI ได้เลย เก็บแค่ field ticket ไว้เป็นสกุลเงิน)
- แก้ navigation component (แถบเมนูหลัก) ให้เหลือปุ่มตรงกับ 5 อย่างข้างบน + ปุ่มกลับ Home

---

## 11. Pause / Exit ระหว่างเล่นเกม (จาก v1 — ยังต้องทำ)

เพิ่มปุ่ม pause มุมบน HUD + ESC listener → freeze physics + overlay "Resume / Exit to Home" ตามรายละเอียดในไฟล์ v1 ข้อ 6

## 12. Performance (จาก v1 — ยังต้องทำ)

`Promise.all()` รวม fetch+import ใน `GameClient.tsx`, เลิกเรียก `refreshDailyAmmo` แบบไม่มีเงื่อนไขใน `play/page.tsx`, เพิ่ม prefetch/cache warming ใน `cache.ts`, เพิ่ม loading skeleton ตามรายละเอียดในไฟล์ v1 ข้อ 5

---

## 13. ปรับโครงสร้าง Google Sheets ใหม่ทั้งหมด (ลบของไม่จำเป็น + จัดให้อ่านง่าย)

Sheet ที่ต้องมี (เขียนใหม่ทั้งหมดใน `scripts/init-sheets.ts`, ลบ sheet เก่าที่ไม่อยู่ในลิสต์นี้):

| Sheet | ใช้ทำอะไร | Column หลัก |
|---|---|---|
| `Players` | ข้อมูลผู้เล่นหลัก | id, email, coin, diamond, ticket, level, exp, currentCharacter, currentWeapon, vipLevel, farmStageMaxWave |
| `Characters` | ค่าสถานะตัวละคร 5 ตัว (ข้อ 3) | id, name, rank, unlockType, unlockValue, hpCurrent, hpMax, speed, accuracy, regen, armorPercent, critChance, critDamage, sprite |
| `Weapons` | ค่าสถานะอาวุธ 11 กระบอก (ข้อ 4) | id, name, unlockType, unlockValue, damage, fireRate, fireMode, accuracy, magazineSize, reloadTime, critChance, critDamage, dailyAmmo, sprite |
| `Equipment` | หมวก/เกราะ/รองเท้า (สำหรับกาชา shop) | id, name, slot(helmet/vest/boots), rarity, statBonusJson, sprite |
| `Enemies` | ศัตรู 5 ประเภท (ข้อ 9) | id, weaponId, hp, coinReward, sprite |
| `PassiveConfig` | ตารางราคา/โบนัส passive (ข้อ 6) | passiveId, tier, cost, currency, bonusPercent |
| `Stage` | ด่านทั่วไป + ด่านฟาร์ม | id, name, isRepeatable, width, height, background, rewardCoin, rewardExp |
| `StageEnemy` | ศัตรูต่อด่าน (เฉพาะด่านทั่วไป) | stageId, enemyId, spawnX, spawnY |
| `PlayerCharacter` | ตัวละครที่ผู้เล่นครอบครอง | playerId, characterId, owned |
| `PlayerWeapon` | อาวุธที่ผู้เล่นครอบครอง/equip | playerId, weaponId, owned, equipped |
| `PlayerWeaponAmmo` | กระสุนรายวันคงเหลือต่ออาวุธ | playerId, weaponId, remainingAmmo, lastResetDate |
| `PlayerEquipment` | อุปกรณ์ที่ผู้เล่นครอบครอง/equip ต่อ slot | playerId, equipmentId, slot, equipped |
| `PlayerPassive` | tier ปัจจุบันของแต่ละ passive ต่อผู้เล่น | playerId, passiveId, currentTier |
| `PlayerStageProgress` | ผ่านด่านทั่วไปแล้วหรือยัง | playerId, stageId, completed |
| `Shop` | รายการไอเทมกาชาในร้าน | id, equipmentId, priceCoin, priceDiamond, priceTicket |
| `Mission` | daily + personal mission รวมกัน | id, type(daily/personal), description, rewardCoin, rewardExp, targetValue |
| `PlayerMission` | ความคืบหน้าภารกิจต่อผู้เล่น | playerId, missionId, progress, claimed |
| `Mail` | จดหมาย/รางวัลพิเศษ | id, playerId, title, rewardJson, claimed, expireAt |
| `Settings` | ตั้งค่าระบบทั่วไป (ไม่ผูกผู้เล่น) | key, value |

**ลบทิ้ง:** `Redeem` (ถ้าไม่มี UI ใช้จริง), `Config`, `Analytics` (ถ้าไม่มีใครอ่าน/เขียนใน production code), `StageReward` (รวมเข้ากับ `Stage` โดยตรงแทน แยกชีทเกินความจำเป็น)

จัดเรียง column ในทุกชีทให้ id/ชื่ออยู่ซ้ายสุดเสมอ, group stat ตัวเลขไว้ติดกัน, ใส่ header row สีพื้นหลังต่างจากข้อมูล (เพื่อให้แก้ง่ายด้วยตา) — ใช้ Google Sheets API format request ใน `init-sheets.ts` ได้เลยถ้าทำได้ ไม่บังคับถ้าเสียเวลาเกินไป

---

## ลำดับความสำคัญที่แนะนำ

1. รีเซ็ตบัญชีทดสอบ (ข้อ 0)
2. ปรับ Google Sheets schema ใหม่ + seed ข้อมูล Characters/Weapons/Enemies/Passive (ข้อ 13, 3, 4, 9, 6)
3. ต่อ asset ภาพเข้า PreloadScene จริง (ข้อ 1)
4. แก้บั๊กร้านค้า + เพิ่มระบบครอบครองอาวุธ + หน้า inventory ลากวาง (ข้อ 2, 4.1, 5)
5. ระบบ passive upgrade (ข้อ 6)
6. บาลานซ์แมพ/ศัตรู/กระสุน + win condition ใหม่ + ด่านฟาร์ม wave scaling (ข้อ 7, 8)
7. ตัดเมนูที่ไม่ใช้ (ข้อ 10)
8. pause/exit + performance (ข้อ 11, 12)
