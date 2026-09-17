# Velin Magic — เว็บไซต์

เว็บรับแสดงมายากลของ Velin · https://velin-magic-site.vercel.app

## ใช้งานเร็ว ๆ

| อยากทำอะไร | แก้ที่ไหน |
| --- | --- |
| เพิ่ม/เปลี่ยนรูปโชว์ | วางไฟล์ใน `photos/shows/<ชื่อโชว์>/` → ดู [photos/README.md](photos/README.md) |
| เปลี่ยนราคา ข้อความโชว์ | `content/shows.json` |
| เปลี่ยนเบอร์โทร LINE โซเชียล | `content/site.json` |
| แก้ข้อความหน้าประเภทงาน | `content/occasions.json` |
| แก้คำถามที่พบบ่อย | `content/faq.json` |
| เปลี่ยนหน้าตา/สี/ฟอนต์ | `src/css/site.css` (สีอยู่ด้านบนสุดของไฟล์) |

แก้เสร็จแล้ว **ดับเบิลคลิก `update-site.cmd`** — ระบบจะสร้างเว็บใหม่และเปิดตัวอย่างให้ดูที่ http://localhost:4321

> ห้ามแก้ไฟล์ในโฟลเดอร์ `public/` โดยตรง — เป็นไฟล์ที่ระบบสร้างให้ จะถูกเขียนทับทุกครั้ง

## ขึ้นเว็บจริง

โปรเจคเชื่อม GitHub → Vercel ไว้แล้ว push ขึ้น branch `main` เมื่อไหร่ เว็บจริงอัปเดตเองภายในไม่กี่นาที

## สำหรับ AI ที่มาช่วยทำงานต่อ

อ่าน [AGENTS.md](AGENTS.md) ก่อนเริ่ม — มีโครงสร้างโปรเจค กฎ และขั้นตอนทั้งหมด

## คำสั่ง (สำหรับคนเขียนโค้ด)

```bash
python -m pip install --user Pillow
python tools/build.py
python -m http.server 4321 --directory public
```
