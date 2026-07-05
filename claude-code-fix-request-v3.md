# Military Shooter 2D — Master Change Request v3 (แทนที่ v2 ทั้งหมด)

ไฟล์นี้แทนที่ `claude-code-fix-request-v2.md` ทั้งหมด (แก้ไข/เพิ่มเติมจากของเดิม) ถ้าอะไรไม่ถูกพูดถึงซ้ำในนี้ ให้ยึด v2 ต่อไป ยกเว้นหัวข้อที่ระบุว่า "แก้ไขจาก v2" ด้านล่างซึ่งให้ใช้ค่าใหม่แทนของเดิมเสมอ

Asset ภาพใหม่ (กระสุน 4 แบบ) สร้างไว้ให้แล้วที่ `public/assets/sprites/bullets/`: `bullet_round.svg`, `bullet_razor.svg`, `bullet_rocket.svg`, `bullet_grenade.svg`

---

## แก้ไขจาก v2

### 1. Azzure ความเร็ว
เป็นค่าพิมพ์ผิด ผู้ใช้แก้ในชีทเป็น **8** แล้ว (ไม่ใช่ 80) — ลบ footnote/หมายเหตุเรื่อง "เกิน scale" ในโค้ดที่อาจ handle ไว้เป็นกรณีพิเศษออก ให้ใช้ 8 เป็นค่าปกติเหมือนตัวละครอื่น ไม่ต้อง cap หรือ special-case อะไรอีก

### 2. ค่าพลัง (HP) และเปอร์เซ็นต์สถานะ ไม่ถูก cap ที่ 200 หรือ 100%
- HP จริงของตัวละครหลังรวม bonus ทั้งหมด (passive + equipment + weapon) **เกิน 200 ได้ปกติ** เพราะมันคือ `maxHP` พื้นฐานที่ถูกคูณด้วย bonus % — เลข "200" ในสเปกเดิมคือค่า max ของตัวละครเปล่าๆ ยังไม่รวม bonus เท่านั้น
- ทุกเปอร์เซ็นต์ (armor%, crit%, critDamage%, accuracy%, ฯลฯ) **บวกสะสมกันได้เกิน 100%** เช่น critDamage รวมทุกแหล่ง = 200% หมายถึงดาเมจคริติคอล = ดาเมจปกติ x 2 (ไม่ cap ที่ 100%)
- สูตรคำนวณ stat จริงตอนเข้าเกม (ทำใน `/api/game/start` หรือ helper กลาง เช่น `src/lib/stats.ts`):
  ```
  finalStat = baseStat * (1 + sumOfAllPercentBonusesForThatStat / 100)
  ```
  โดย `sumOfAllPercentBonusesForThatStat` มาจากรวมกันของ: ตัวละคร (base มีติดตัวอยู่แล้วเช่น armor%, crit% ของ character เอง), Passive tier ที่ปลดล็อก, Equipment (helmet+vest+boots) รวม dupe-upgrade level ของแต่ละชิ้น, และ Weapon stat ที่เกี่ยวข้อง (accuracy, critChance, critDamage ของอาวุธเอง)
  - HP, ATK(damage) ใช้สูตรคูณข้างบนตรงๆ
  - Accuracy/Armor/CritChance/CritDamage ก็ใช้สูตรเดียวกัน แต่ **ไม่ clamp ที่ 100%** ปล่อยให้เกินได้ตามดีไซน์

---

## 3. ระบบ Gacha ใหม่ (เปลี่ยนจาก "Shop" ซื้อของตรงๆ เป็น "Gacha" สุ่มเท่านั้น)

**เปลี่ยนชื่อ/route ทุกจุด:** `Shop` → `Gacha` (route `/shop` → `/gacha`, component `ShopClient.tsx` → `GachaClient.tsx`, ปุ่มเมนู, sheet `Shop` → `GachaConfig`) หน้า Gacha **ใช้สุ่มเพื่อได้อุปกรณ์ (หมวก/เกราะ/รองเท้า) เท่านั้น** ไม่มีซื้อของตรงๆ อีกต่อไป (ตัวละครกับอาวุธยังซื้อที่หน้า character/weapon ของมันตามเดิม ไม่เกี่ยวกับ gacha)

ไอคอนแคปซูล: ใช้ `public/assets/sprites/ui/shop_gacha_capsule.svg` ที่มีอยู่แล้ว

### กาชา 2 บ่อ

| บ่อ | ราคา/ครั้ง | Drop table |
|---|---|---|
| กาชาเพชร | 100 เพชร | epic 5%, rare 20%, common 35%, เหรียญ 100 เหรียญ 40% |
| กาชา ticket | 100 ticket | legendary 5%, epic 20%, rare 35%, เพชร 100 เพชร 40% |

- ของที่สุ่มได้ (นอกจากเงิน) คือหมวก/เกราะ/รองเท้า แบบสุ่ม slot ด้วย (สุ่มก่อนว่าได้ rarity อะไรตามตาราง แล้วสุ่ม slot ใน 3 อย่างอีกที)
- ถ้าได้ชิ้นที่ซ้ำกับที่มีอยู่แล้ว (ชิ้นเดิม, rarity เดิม, slot เดิม) → เอาไปอัปเกรด "ระดับพัฒนา" ของชิ้นนั้นได้ (ไม่ได้เพิ่มเป็นชิ้นใหม่ในคลัง) — เก็บ `PlayerEquipmentLevel` (playerId, equipmentId, upgradeLevel) โดยการันตี dupe = +1 upgradeLevel ให้ชิ้นนั้นทันที (ไม่ต้องใช้เงินเพิ่ม การได้ dupe จาก gacha คือ "ค่าธรรมเนียม" อยู่แล้ว)
- เพิ่ม sheet `GachaConfig` (poolId, currency, cost, rarity, dropRate) แทน sheet `Shop` เดิม, สร้าง API `/api/gacha/pull` คืนผลลัพธ์ไอเทม/เงินที่ได้ พร้อม popup แสดงผลที่สุ่มได้

### ค่าสถานะพื้นฐานของอุปกรณ์ตาม rarity (แทนที่ระบบ equipment เดิมทั้งหมด)

**หมวก (Helmet)**

| Rarity | โบนัส |
|---|---|
| common | HP +4% |
| rare | HP +8%, ATK +8% |
| epic | HP +16%, ATK +16%, CritDMG +20% |
| legendary | HP +25%, ATK +25%, CritRate +4%, CritDMG +40% |

**ชุดเกราะ (Vest)**

| Rarity | โบนัส |
|---|---|
| common | HP +5% |
| rare | HP +10%, ATK +10% |
| epic | HP +20%, ATK +20%, CritDMG +10% |
| legendary | HP +30%, ATK +30%, CritRate +3%, CritDMG +30% |

**รองเท้า (Boots)**

| Rarity | โบนัส |
|---|---|
| common | HP +3% |
| rare | HP +6%, ATK +6% |
| epic | HP +12%, ATK +12%, CritDMG +30% |
| legendary | HP +20%, ATK +20%, CritRate +5%, CritDMG +50% |

### โบนัสจากการอัปเกรด dupe (ต่อ 1 ระดับที่อัปเกรด, สะสมได้ไม่จำกัด level เว้นแต่จะกำหนด cap ทีหลัง)

| Rarity | โบนัสต่อ 1 upgrade level |
|---|---|
| common | HP +1% |
| rare | HP +1%, ATK +1% |
| epic | HP +1%, ATK +1%, CritDMG +1% |
| legendary | HP +1%, ATK +1%, CritRate +1%, CritDMG +1% |

รวมสูตรจริงต่อชิ้น: `bonus = baseRarityBonus + (upgradeLevel * dupeBonusPerLevel)` ต่อ stat นั้นๆ แล้วเอาไปรวมกับของชิ้นอื่นและ passive/character/weapon ตามสูตรข้อ 2

Seed ข้อมูล rarity/slot ทั้งหมดนี้ลง sheet `Equipment` ให้ครบ (ลบ equipment เดิมที่ไม่ตรง schema ใหม่นี้ทิ้ง)

---

## 4. บั๊ก/ปรับแก้ที่พบระหว่างทดสอบ

1. **Sniper ยังไม่มีเส้นเล็งตรง** — ที่ทำไปก่อนหน้าเป็นแค่เส้นตกแต่งในไฟล์ sprite เฉยๆ ให้ implement จริงใน `GameScene.ts`/`Player.ts`: วาด `Phaser.GameObjects.Graphics` เป็นเส้นตรงสีแดงจากตัวละครไปยังทิศที่เล็งอยู่แบบ real-time เฉพาะตอน equip sniper เท่านั้น (ความยาวเส้น = สุดระยะแมพ หรือจนชนสิ่งกีดขวาง)
2. **ตัวละครเดินเร็วเกินไป** — ลดค่า base move speed multiplier ลง (หาจุดคำนวณ px/s จาก `character.speed` ใน `Player.ts`/`GameScene.ts` แล้วลดตัวคูณลง เช่น ลดลงประมาณ 30-40% จากปัจจุบัน แล้วให้ผู้ใช้ทดสอบปรับอีกทีตามความรู้สึก)
3. **Gatling ยิงผิด** — แก้จากที่ระบุใน v2 (ยิง 12 นัดพร้อมกันเป็น volley) เป็น: **ยิงทีละ 1 นัดต่อการยิง แต่ยิงถี่ 12 ครั้ง/วินาที** แต่ละนัดมีองศาสุ่มเบี่ยงในกรอบแคบ (ดูข้อ 5 เรื่ององศา) ไม่ใช่กระสุนพรวดเดียวหลายนัด
4. **Shotgun/Gatling กระจายกว้างเกินไป** — ปรับองศาการกระจาย: **Shotgun รวมไม่เกิน 5 องศา** (จากเดิมที่ตั้งไว้กว้างกว่านี้มาก), **Gatling รวมไม่เกิน 2 องศา** ต่อนัด (สลับค่ากับที่เคยกำหนดผิดใน v2) Shotgun ยังคงยิง 16 นัดพร้อมกันต่อ 1 การเหนี่ยวไก (ปกติ) แค่บีบมุมกระจายให้แคบลง
5. **ช่องใส่ของใน Inventory ไม่บอกว่าใส่อะไรอยู่** — แก้ UI ช่อง 4 มุม (อาวุธ/หมวก/เกราะ/รองเท้า) ให้แสดง sprite icon + ชื่อไอเทมที่ equip อยู่จริงเสมอ (ไม่ใช่กรอบว่างเฉยๆ)
6. **เปลี่ยนชื่อ Shop → Gacha** ดูข้อ 3
7. **บั๊กตัวละครหาย** — พบว่าบางครั้งตัวละครผู้เล่นหายไปจากจอระหว่างเล่น ให้ตรวจสอบ: การโหลด sprite key ผิด/ไม่ตรงกับที่ preload ไว้ (โดยเฉพาะหลังเปลี่ยนมาใช้ sprite ใหม่ 5 ตัวละครในข้อ 1 ของ v2), z-index/depth ของ player container ถูก sprite อื่นบังหรือไม่, หรือ physics body หลุดออกนอก bounds จนมองไม่เห็น — ต้องหาสาเหตุจริงแล้วแก้ ไม่ใช่แค่เดา
8. **กระสุนทะลุข้าศึกได้** — แก้ collision handler ให้กระสุน (ยกเว้น rocket/grenade ที่มี AoE) **ทำลายตัวเองทันทีที่ชนศัตรู 1 ตัว** ไม่ทะลุไปโดนตัวถัดไป (ตรวจ `physics.add.overlap`/`collider` callback ใน `GameScene.ts` ว่ามี `bullet.destroy()` หลัง apply damage หรือยัง)
9. **เพิ่ม progress bar ตอนรีโหลด** — ใน `HUDScene.ts` ให้แสดง charging/progress bar ระหว่างที่ตัวละคร (หรือศัตรู) กำลังรีโหลดอยู่ ให้เห็นว่ารีโหลดถึงไหนแล้ว
10. **ข้าศึกเดินหลุดออกนอกแมพได้** — เพิ่ม world bounds collision ให้ enemy (`this.physics.world.setBounds(...)` + `enemy.body.setCollideWorldBounds(true)` หรือ clamp ตำแหน่งใน update loop)
11. **อธิบายความหมายของ "ความแม่นยำ" (accuracy) ให้ชัดในโค้ด/คอมเมนต์:** accuracy% = โอกาสที่การยิงจะ "ติดและสร้างดาเมจ" ไม่ใช่โอกาสยิงโดนตัว เช่น accuracy 80% = ทุกนัดที่ชนศัตรู มีโอกาส 80% ที่จะสร้างดาเมจจริง อีก 20% ให้นับเป็น MISS (ไม่เสียดาเมจ) — ต้อง roll สุ่มทุกครั้งที่กระสุนชนศัตรู แล้วถ้า miss ให้ขึ้นข้อความลอย "MISS" สีเทา/ขาวเหนือหัวศัตรู (คล้าย damage number popup ที่อาจมีอยู่แล้ว)
12. **แก้ไขใน Google Sheet สำหรับอาวุธได้ต่อไปปกติ** — ยืนยัน: ทุก stat อาวุธยังคงอ่านจาก sheet `Weapons` แบบ data-driven ตามที่ออกแบบไว้ ผู้ใช้แก้ค่าตัวเลขใน sheet ได้เองตลอดเวลาโดยไม่ต้องแก้โค้ด (ห้าม hardcode ค่าอาวุธใน frontend/backend เด็ดขาด)
13. **แสดงผลรวมค่าสถานะใน Inventory** — หน้า inventory/equipment ต้องมีส่วนสรุปสถานะรวมของผู้เล่น แสดงรูปแบบ "ค่าฐาน + โบนัสรวม% = ค่าจริง" ต่อสถานะ เช่น:
    ```
    พลังชีวิต: 100 (+135%) = 235
    พลังโจมตี: 20 (+64%) = 32.8
    อัตราคริติคอล: 5% (+42%) = 47%
    ดาเมจคริติคอล: 300% (+120%) = 420%
    ```
    ให้คำนวณจากสูตรข้อ 2 รวมทุกแหล่ง (character + weapon + equipment + dupe upgrade + passive) แล้วแสดงทุกสถานะ (HP, ATK, ความเร็ว, ความแม่นยำ, เกราะ%, คริติคอล%, ดาเมจคริติคอล%, ความเร็วรีโหลด, ความเร็วยิง, กระสุนรายวัน)
14. **เปลี่ยนรูปกระสุน** ใช้ asset ใหม่ที่สร้างไว้แล้ว: อาวุธทั่วไปทุกกระบอก (pistol, double_pistol, m16a1, m16a4, shotgun, ak47, gatling, sniper) → `bullet_round.svg` (กระสุนกลมเล็ก), Rasor gun → `bullet_razor.svg` (เส้นตรงเล็ก), Rocket Launcher → `bullet_rocket.svg` (จรวดเล็ก), Grenade Launcher → `bullet_grenade.svg` (ระเบิดเล็ก) — แก้ path การโหลด bullet texture ใน `PreloadScene.ts` และจุดสร้างกระสุนใน `Player.ts`/`GameScene.ts` ให้ map ตาม weaponId

---

## ลำดับความสำคัญที่แนะนำสำหรับรอบนี้

1. บั๊กตัวละครหาย (ข้อ 4.7) — กระทบเล่นไม่ได้เลย
2. กระสุนทะลุศัตรู + ข้าศึกหลุดแมพ (ข้อ 4.8, 4.10) — กระทบ core gameplay
3. แก้ gatling/shotgun spread + ความเร็วตัวละคร (ข้อ 4.2, 4.3, 4.4)
4. ระบบ Gacha ใหม่ทั้งหมด + equipment rarity/dupe-upgrade (ข้อ 3)
5. สูตรคำนวณ stat รวม % เกิน 100 + แสดงผลรวมใน inventory (ข้อ 2, 4.13)
6. UI: ช่อง inventory โชว์ไอเทม, reload bar, MISS popup, sniper laser, bullet sprite ใหม่ (ข้อ 4.1, 4.5, 4.9, 4.11, 4.14)
