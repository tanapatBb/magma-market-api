require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// 📌 ตั้งค่า Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // รองรับภาพ Base64 ขนาดใหญ่

// 📌 1. ตั้งค่า Gemini AI
let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("✅ Gemini AI Initialized Successfully");
  } else {
    console.warn("⚠️ GEMINI_API_KEY is missing in environment variables");
  }
} catch (e) {
  console.error("⚠️ Failed to load @google/generative-ai package:", e.message);
}

// 📌 2. ตัวแปรจำลองฐานข้อมูลสินค้า (In-Memory Database)
let productsList = [
  {
    id: 1,
    name: "Lactasoy นมถั่วเหลือง",
    brand: "Lactasoy",
    volumeValue: 300,
    volumeUnit: "ml",
    price: 15,
    stock: 50
  }
];

// 📌 3. API ดึงรายการสินค้าทั้งหมด (GET /api/products)
app.get('/api/products', (req, res) => {
  try {
    res.json(productsList);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 📌 4. API บันทึกสินค้าใหม่ (POST /api/products)
app.post('/api/products', (req, res) => {
  try {
    const newProduct = req.body;
    
    // สร้าง ID ให้อัตโนมัติด้วย timestamp
    newProduct.id = Date.now();
    
    // เพิ่มสินค้าไว้บนสุดของ Array
    productsList.unshift(newProduct);

    console.log('✅ บันทึกสินค้าใหม่สำเร็จ:', newProduct);

    res.json({ 
      status: 'success', 
      message: 'บันทึกข้อมูลเรียบร้อย',
      data: newProduct 
    });
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 📌 5. API สแกนซองอาหารด้วย Gemini AI (POST /api/scan-bag)
app.post('/api/scan-bag', async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ Render' 
      });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ status: 'error', message: 'กรุณาส่งรูปภาพ' });
    }

    // ตัด Prefix data:image/...;base64, ออกอย่างปลอดภัย
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // เรียกใช้โมเดล gemini-1.5-flash
   const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash-latest",
  generationConfig: { responseMimeType: "application/json" }
});

    const prompt = `
      โปรดวิเคราะห์รูปภาพบรรจุภัณฑ์สินค้า/ซองอาหาร/กล่องสินค้าในภาพนี้ แล้วดึงข้อมูลออกมาในรูปแบบ JSON ภาษาไทยหรืออังกฤษ ดังนี้:
      1. "brand": ชื่อยี่ห้อ แบรนด์ หรือชื่อสินค้าหลักที่เห็นชัดที่สุดบนบรรจุภัณฑ์ (เช่น SmartHeart, Royal Canin, Lactasoy)
      2. "volumeValue": ตัวเลขระบุขนาด น้ำหนัก หรือปริมาตรบรรจุ เช่น 500, 1.2, 3, 250 (ตอบเฉพาะตัวเลขเท่านั้น ถ้าไม่มีให้ใส่ null)
      3. "volumeUnit": หน่วยของขนาด เลือกระหว่าง "g", "kg", "ml", "L", "ชิ้น" (เช่น นม 250ml ให้ตอบ "ml", อาหาร 1.2kg ให้ตอบ "kg")

      ตัวอย่างโครงสร้างผลลัพธ์ JSON:
      {
        "brand": "Lactasoy",
        "volumeValue": 300,
        "volumeUnit": "ml"
      }
    `;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const extractedData = JSON.parse(responseText);

    res.json({
      status: 'success',
      data: extractedData
    });

  } catch (error) {
    console.error('Gemini Scan Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'เกิดข้อผิดพลาดในการอ่านรูปภาพ: ' + error.message 
    });
  }
});

// 📌 6. เปิดเซิร์ฟเวอร์รันตลอดเวลา
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});