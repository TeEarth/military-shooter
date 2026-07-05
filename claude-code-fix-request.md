# Prompt สำหรับส่งต่อให้ Claude Code — Military Shooter 2D

โปรเจกต์: Next.js 15 + Phaser 3, ใช้ Google Sheets เป็น backend (ดู `src/lib/google/*`)
ด้านล่างคือ 8 งานที่ต้องแก้ไข พร้อมไฟล์ที่เกี่ยวข้องที่พบจากการวิเคราะห์โค้ดจริงแล้ว

---

## 1. แก้บั๊ก: ซื้อของในร้านค้าไม่ได้

ไฟล์ที่เกี่ยวข้อง: `src/components/shop/ShopClient.tsx`, `src/app/api/shop/buy/route.ts`, `src/lib/google/inventory.ts`

ปัญหาที่พบ:
- `ShopClient.tsx` เรียก `/api/shop/buy` และแสดงข้อความ success/error ได้ แต่**ไม่ refetch ยอด coin/diamond ของผู้เล่นหลังซื้อสำเร็จ** ทำให้ UI ค้างค่าเดิมจนกว่าจะ reload หน้า
- `grantEquipmentToPlayer()` ใน `inventory.ts` แค่ append row ลง sheet `PlayerEquipment` เฉยๆ โดยไม่ตรวจ/handle กรณี append ล้มเหลว (silent fail)
- endpoint `/api/shop/buy` ไม่ได้ return ยอดเงินที่อัปเดตแล้วกลับไปให้ client ใช้

สิ่งที่ต้องแก้:
- ให้ `/api/shop/buy` return `updatedPlayer` (coin, diamond ใหม่) ใน response หลังหักเงิน+มอบไอเทมสำเร็จ
- ให้ `ShopClient.tsx` อัปเดต state coin/diamond ทันทีจาก response (หรือ refetch player) หลังซื้อสำเร็จ ไม่ต้อง reload หน้า
- เพิ่ม error handling ที่ชัดเจนถ้า `grantEquipmentToPlayer` ล้มเหลว (ห้ามหักเงินถ้ามอบไอเทมไม่สำเร็จ — ต้อง atomic หรืออย่างน้อย rollback)
- เพิ่ม loading state ที่ปุ่มซื้อระหว่างรอ API ตอบกลับ กันการกดซ้ำ

---

## 2. เปลี่ยนระบบจาก "เลือกตัวละคร" เป็น "ครอบครอง/สวมอาวุธ" แทน

สถานะปัจจุบัน: ระบบ equip ตัวละคร (`src/components/character/CharacterClient.tsx` → `/api/character/equip` → เขียนลง field `currentCharacter` ใน sheet `Players`) **ทำงานได้ปกติอยู่แล้ว** แต่ระบบอาวุธ (`src/lib/google/weapon.ts`, sheet `Weapons`) เป็น read-only ยังไม่มีการครอบครองของผู้เล่นเลย

ให้ทำการ "ย้ายกลไก" จากตัวละครไปเป็นอาวุธ:

1. เพิ่ม sheet ใหม่ `PlayerWeapon` (columns: `playerId, weaponId, owned, equipped`) คู่กับ `PlayerCharacter` ที่มีอยู่ — แก้ `scripts/init-sheets.ts` ให้ init sheet นี้ด้วย
2. สร้าง API route ใหม่ `src/app/api/weapon/equip/route.ts` (ก็อปพฤติกรรมจาก `src/app/api/character/equip/route.ts` แต่เขียนลง `PlayerWeapon` แทน field `currentCharacter`)
3. แปลง `src/app/character/page.tsx` + `CharacterClient.tsx` ให้กลายเป็นหน้า "คลังอาวุธ" (เปลี่ยน route เป็น `/weapon` หรือคงที่เดิมได้ตามสะดวก) — list อาวุธที่มี, ปุ่ม EQUIP/ACTIVE เหมือนเดิมแต่ยิงไปที่ `/api/weapon/equip`
4. แก้ `GameClient.tsx` และ `GameScene.ts`: ตอนโหลดเกม ให้ดึง **อาวุธที่ equip อยู่** มาคำนวณ stat การยิง (damage, fireRate, accuracy, reloadSpeed, magazineSize) แทนที่จะอ่าน stat จาก character ตรงๆ — ตัวละคร (character) ให้เหลือแค่กำหนด HP/moveSpeed/sprite ของผู้เล่นเท่านั้น ส่วนอาวุธกำหนด damage/fireRate/accuracy/reload/magazine
5. ปรับ `src/app/api/shop/buy/route.ts` ให้รองรับ `itemType: "weapon"` เพิ่มจาก `"equipment"` ที่มีอยู่แล้ว (มอบ owned=true ใน `PlayerWeapon`)

---

## 3. เพิ่มหน้าใส่อุปกรณ์เสริม (Equipment page)

สถานะปัจจุบัน: **ไม่มีหน้านี้เลย** — อุปกรณ์ (`Equipment` sheet, `PlayerEquipment` sheet) ตอนนี้แสดงได้แค่แบบ read-only ใน `src/app/inventory/page.tsx` เท่านั้น ยังกดใส่/ถอดไม่ได้

ให้สร้าง:
- หน้าใหม่ `src/app/equipment/page.tsx` + component `src/components/equipment/EquipmentClient.tsx`
- แสดงอุปกรณ์ที่ผู้เล่นครอบครอง (จาก `PlayerEquipment`), แยกตาม slot (เช่น helmet, vest, backpack — กำหนด slot ใน sheet `Equipment` ให้มี column `slot`)
- ปุ่ม EQUIP/UNEQUIP ต่อ slot, เขียนสถานะ equipped ลง `PlayerEquipment`
- สร้าง API route `src/app/api/equipment/equip/route.ts` สำหรับ equip/unequip
- ให้ stat จากอุปกรณ์ที่ equip อยู่ถูกรวมเข้ากับ stat ตัวละคร/อาวุธตอนเริ่มเกม (แก้ `/api/game/start/route.ts` ให้ query แล้ว sum stat เข้าไปด้วย)

---

## 4. เพิ่มหน้าสถานะตัวละครจริง (อ่านค่าจาก Google Sheet ที่จะแก้เอง)

ต้องการหน้าที่แสดง stat ของตัวละครแต่ละตัวแบบละเอียด (ไม่ใช่แค่ list เลือก) โดย stat มาจาก column ที่มีอยู่แล้วใน sheet `Characters`:
`damage, hp, ammo, fireRate, accuracy, moveSpeed, reloadSpeed, criticalChance, criticalDamage, armor, magazineSize`

ให้ทำ:
- เพิ่ม component แสดง stat แบบ bar/radar หรือ list ตัวเลขในหน้า character ที่มีอยู่ (`CharacterClient.tsx`) — ให้ตัวละครแต่ละตัวโชว์ stat ต่างกันชัดเจนตามที่แก้ใน Google Sheet
- **ห้าม hardcode ค่า stat ใน frontend** ต้อง fetch จาก `/api/characters` (ที่อ่านจาก sheet) ทุกครั้ง เพื่อให้แก้ค่าใน Google Sheet แล้วเห็นผลทันทีโดยไม่ต้อง deploy โค้ดใหม่
- เพิ่ม cache-busting หรือลด TTL ของ `cache.ts` เฉพาะ endpoint นี้ถ้าจำเป็น เพื่อให้แก้ sheet แล้วเห็นผลเร็ว

---

## 5. แก้ปัญหาโหลดหน้าช้า / กดอะไรก็หน่วง

ปัญหาที่พบจริงในโค้ด:
- `src/components/game/GameClient.tsx` (บรรทัด ~23-48): เรียก `await fetch('/api/game/start')` แบบ sequential ก่อนแล้วค่อย `await import('phaser')` และ dynamic import scenes ทีละตัว ทำให้เสียเวลารอต่อกัน — ให้แก้เป็นดึง stage data กับ import Phaser/scenes พร้อมกันด้วย `Promise.all()`
- `src/app/play/page.tsx` (บรรทัด ~18): เรียก `refreshDailyAmmo(player)` ซึ่งเป็น **DB write** ทุกครั้งที่เข้าหน้านี้ แม้เพิ่งเข้ามาเมื่อไม่กี่วินาทีก่อน — ให้เช็คเงื่อนไขก่อนว่าจำเป็นต้อง refresh จริงไหม (เช็ค timestamp ล่าสุดก่อน write)
- `src/lib/google/cache.ts`: TTL 60 วินาทีแต่ไม่มี prefetch/cache warming และไม่มีการ preload ข้อมูลตอน hover/navigate ล่วงหน้า — ให้เพิ่ม prefetch stage/character data ตอนอยู่หน้า home ก่อนกดเข้า play
- ไม่มี loading skeleton ที่หน้าไหนเลย มีแค่ text "Loading..." เฉยๆ — ให้เพิ่ม skeleton component พื้นฐานในหน้า home, play, character, inventory เพื่อ perceived performance ดีขึ้น
- ตรวจดูด้วยว่า API routes อื่นๆ (`/api/player`, `/api/stages`, `/api/characters`) มีการอ่าน Google Sheets แบบ sequential ซ้อนกันหรือไม่ (เช่นอ่านทีละ sheet) ถ้ามีให้ทำ `Promise.all()` รวมการอ่านที่ไม่ dependent กัน

---

## 6. เพิ่มปุ่มหยุด/ออกจากเกมระหว่างเล่น

สถานะปัจจุบัน: **ไม่มีเลย** — `GameScene.ts` มีแค่ keyboard listener สำหรับ WASD/SPACE/R เท่านั้น ไม่มี ESC หรือปุ่ม pause ใดๆ, `HUDScene.ts` มีแค่แสดงสถานะ ไม่มีปุ่ม

ให้เพิ่ม:
- ปุ่ม Pause (ไอคอนมุมบนใน `HUDScene.ts`) + keyboard listener ESC ใน `GameScene.ts`
- เมื่อกด pause: freeze physics (`this.physics.pause()` หรือ `scene.pause()`) และเปิด overlay/modal ที่มีปุ่ม "Resume" และ "Exit to Home"
- ปุ่ม "Exit to Home": เรียก `onGameEnd` callback (ที่มีอยู่แล้วใน `GameClient.tsx`) พร้อม flag `completed: false` เพื่อบันทึกผลบางส่วน (หรือไม่บันทึกก็ได้ตามที่ต้องการ) แล้ว `router.push('/home')` และ destroy game instance ให้ถูกต้อง (ป้องกัน memory leak จาก Phaser game ที่ไม่ destroy)

---

## 7. เพิ่มด่านสำหรับฟาร์มไอเทม/เงิน

สถานะปัจจุบัน: ด่านอยู่ใน sheet `Stage` + `StageEnemy` + `StageReward` ระบบเล่นซ้ำได้ไม่จำกัดอยู่แล้ว (ไม่มี lock การเล่นซ้ำ) แต่ยังไม่มี flag แยกด่านฟาร์มจากด่าน story

ให้ทำ:
- เพิ่ม column `isRepeatable` (boolean) ใน sheet `Stage` และปรับ `src/types/stage.ts` ให้รองรับ field นี้
- เพิ่มด่านใหม่ 1 ด่านชื่อ เช่น `farm_01` ("Training Grounds") ใน `scripts/init-sheets.ts` และใน sheet จริง ตั้ง `isRepeatable: true`, reward coin/exp ปานกลาง
- แก้ `src/components/play/StageSelectClient.tsx` ให้แสดง badge "FARM" หรือแยก section ด่านฟาร์มออกจาก story mode ชัดเจน และไม่ต้องผ่านด่านก่อนหน้าถึงจะปลดล็อก (ปลดล็อกได้ตั้งแต่ต้น หรือกำหนด stage requirement ต่ำ)
- (ถ้าต้องการ) เพิ่ม diminishing return หรือ cooldown ถ้าไม่อยากให้ฟาร์มได้ไม่จำกัดจริง — ระบุใน sheet `StageReward` ด้วย column `diamondChance` ที่มีอยู่แล้ว

---

## 8. Assets ตัวละคร/ศัตรู/สิ่งกีดขวาง/พื้นหลังใหม่ (แนบมาเป็น zip แยก)

ไฟล์ภาพที่ส่งมาให้แยกเป็น zip คนละไฟล์ ให้:
- นำไฟล์ทหาร (มุมบน, ทรงกลม) ไปใส่ที่ `public/assets/sprites/characters/`
- ไฟล์ศัตรู ไปที่ `public/assets/sprites/enemy/`
- ไฟล์สิ่งกีดขวาง (cover object) ไปที่ `public/assets/sprites/tilemap/` หรือโฟลเดอร์ cover ใหม่
- ไฟล์พื้นหลัง ไปที่ `public/assets/sprites/background/`
- แก้ `src/game/scenes/PreloadScene.ts` ให้ชี้ path ไปยังไฟล์ใหม่เหล่านี้ (ตรวจ key ชื่อภาพให้ตรงกับที่ `GameScene.ts`, `src/game/entities/Player.ts`, `Enemy.ts`, `CoverObject.ts` เรียกใช้)
- ปรับขนาด sprite ศัตรูใน `Enemy.ts` (ปัจจุบันตัวใหญ่เกินไป) ให้ scale ลงให้สัดส่วนใกล้เคียงกับตัวละครผู้เล่น

---

## ลำดับความสำคัญที่แนะนำ

1. แก้บั๊กซื้อของในร้าน (กระทบ core loop ตรงๆ)
2. เพิ่มปุ่ม pause/exit (ผู้เล่นค้างในเกมไม่ได้ตอนนี้)
3. ระบบอาวุธ + หน้า equipment (งานใหญ่สุด แตะหลายไฟล์)
4. หน้าสถานะตัวละครจาก sheet
5. Performance fix
6. ด่านฟาร์ม
7. ใส่ asset ใหม่ + ปรับขนาดศัตรู
