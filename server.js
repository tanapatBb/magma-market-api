// 📌 นำเข้า dotenv ไว้บรรทัดแรกสุด
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ปรับรับไฟล์ Base64 รูปภาพขนาดใหญ่ได้

// 📌 เรียกใช้ Gemini SDK แบบปลอดภัย
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
  console.error("⚠️ Failed to load @google/generative-ai module:", e.message);
}

// 📌 API Endpoint สำหรับสแกนซองอาหาร
app.post('/api/scan-bag', async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ status: 'error', message: 'Gemini AI API Key ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์' });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ status: 'error', message: 'กรุณาส่งรูปภาพ' });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      โปรดวิเคราะห์รูปภาพบรรจุภัณฑ์สินค้า/ซองอาหาร/กล่องสินค้าในภาพนี้ แล้วดึงข้อมูลออกมาในรูปแบบ JSON ภาษาไทยหรืออังกฤษ ดังนี้:
      1. "brand": ชื่อยี่ห้อ แบรนด์ หรือชื่อสินค้าหลักที่เห็นชัดที่สุดบนบรรจุภัณฑ์ (เช่น SmartHeart, Royal Canin, Lactasoy, ปกติ, ดักมิลค์)
      2. "volumeValue": ตัวเลขระบุขนาด น้ำหนัก หรือปริมาตรบรรจุ เช่น 500, 1.2, 3, 250, 500 (ตอบเฉพาะตัวเลขเท่านั้น ถ้าไม่มีให้ใส่ null)
      3. "volumeUnit": หน่วยของขนาด เลือกระหว่าง "g", "kg", "ml", "L", "ชิ้น" (เช่น นม 250ml ให้ตอบ "ml", อาหาร 1.2kg ให้ตอบ "kg")

      ตัวอย่างโครงสร้างผลลัพธ์ JSON ที่ต้องการ:
      {
        "brand": "Lactasoy",
        "volumeValue": 300,
        "volumeUnit": "ml"
      }
    `;

    const imagePart = {
      inlineData: {
        data: imageBase64.split(',')[1],
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
    res.status(500).json({ status: 'error', message: 'ไม่สามารถประมวลผลรูปภาพได้: ' + error.message });
  }
});

// 📌 กำหนด PORT ให้รองรับทั้งบน Render และ Local
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

// 📌 API สำหรับดึงรายการสินค้าทั้งหมด
app.get('/api/products', async (req, res) => {
  try {
    // โค้ดดึงข้อมูลสินค้าเดิมของคุณ (เช่น ดึงจาก Google Sheets หรือ Database)
    // ตัวอย่างการส่งข้อมูลกลับ:
    res.json(productsData || []);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลสินค้าได้' });
  }
});