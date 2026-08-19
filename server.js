require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 📌 1. ตั้งค่า Gemini AI
let genAI = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("✅ Gemini AI Initialized");
  }
} catch (e) {
  console.error("⚠️ Failed to load Gemini AI:", e.message);
}

// 📌 2. จำลองฐานข้อมูลสินค้าใน Memory (พร้อม ID ที่ชัดเจน)
let productsList = [
  {
    id: "prod-1",
    name: "SmartHeart อาหารสุนัขพันธุ์เล็ก 1.2kg",
    brand: "SmartHeart",
    volumeValue: 1.2,
    volumeUnit: "kg",
    price: 159,
    stock: 20
  }
];

// 📌 3. API ดึงรายการสินค้าทั้งหมด
app.get('/api/products', (req, res) => {
  res.json(productsList);
});

// 📌 4. API เพิ่มสินค้าใหม่
app.post('/api/products', (req, res) => {
  try {
    const { name, brand, volumeValue, volumeUnit, price, stock } = req.body;
    
    const newProduct = {
      id: "prod-" + Date.now(), // สร้าง ID ที่ไม่ซ้ำกัน
      name: name || `${brand || 'สินค้า'} ${volumeValue || ''}${volumeUnit || ''}`,
      brand: brand || "-",
      volumeValue: Number(volumeValue) || 0,
      volumeUnit: volumeUnit || "g",
      price: Number(price) || 0,
      stock: Number(stock) || 0
    };

    productsList.unshift(newProduct);
    console.log("✅ เพิ่มสินค้าสำเร็จ:", newProduct);
    res.json({ status: "success", data: newProduct });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 📌 5. API ลบสินค้าตาม ID (แก้ปัญหาลบมั่ว)
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const initialCount = productsList.length;
  productsList = productsList.filter(item => String(item.id) !== String(id));

  if (productsList.length < initialCount) {
    console.log(`🗑️ ลบสินค้า ID: ${id} เรียบร้อย`);
    res.json({ status: "success", message: "ลบรายการสำเร็จ" });
  } else {
    res.status(404).json({ status: "error", message: "ไม่พบสินค้าที่ต้องการลบ" });
  }
});

// 📌 6. API สแกนซองอาหารด้วย AI (ฉลาดขึ้น + อ่านได้แม่นยำขึ้น)
app.post('/api/scan-bag', async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ status: 'error', message: 'กรุณาตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์' });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ status: 'error', message: 'กรุณาส่งรูปภาพ' });
    }

    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // ใช้ gemini-1.5-flash-latest หรือ gemini-2.5-flash เพื่อความเสถียร
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest",
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.1 // ตั้งค่าให้ AI ตอบแบบแม่นยำ ไม่สุ่มคำ
      }
    });

    const prompt = `
      คุณคือผู้เชี่ยวชาญด้านการวิเคราะห์บรรจุภัณฑ์อาหารสัตว์และสินค้าอุปโภคบริโภค
      โปรดวิเคราะห์ภาพซองอาหาร/สินค้าสัตว์เลี้ยงนี้ แล้วตอบกลับมาเป็น JSON ตามโครงสร้างนี้เท่านั้น:

      {
        "brand": "ยี่ห้อหรือแบรนด์หลักของสินค้า เช่น SmartHeart, Royal Canin, Pedigree, Whiskas, Me-O, Felipro",
        "productName": "ชื่อสินค้าหรือสูตร เช่น สูตรสุนัขโต รสตับ, อาหารแมวโต รสปลาทู",
        "volumeValue": ตัวเลขน้ำหนักหรือขนาดบรรจุภัณฑ์ (เฉพาะตัวเลขเท่านั้น เช่น 1.2, 500, 3, 400),
        "volumeUnit": "หน่วยของขนาด ตอบเฉพาะอย่างใดอย่างหนึ่งคือ 'g', 'kg', 'ml', 'L', หรือ 'ชิ้น'"
      }

      คำแนะนำเพิ่มเติม:
      - พยายามหาตัวเลขน้ำหนักสุทธิ (Net Weight) บนซอง
      - หากไม่พบยี่ห้อให้ใส่ "ไม่ระบุ"
      - หากไม่พบขนาดตัวเลข ให้ใส่ null
    `;

    const imagePart = {
      inlineData: { data: base64Data, mimeType: 'image/jpeg' }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const extractedData = JSON.parse(result.response.text());

    res.json({ status: 'success', data: extractedData });

  } catch (error) {
    console.error('Gemini Scan Error:', error);
    res.status(500).json({ status: 'error', message: 'AI ไม่สามารถอ่านรูปภาพได้: ' + error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// 📌 API เพิ่มสินค้าใหม่ (รองรับชื่อตัวแปรทุกรูปแบบ)
app.post('/api/products', (req, res) => {
  try {
    const { 
      name, brand, productName,
      volumeValue, volumeUnit, size,
      price, stock, quantity, expDate 
    } = req.body;

    const val = volumeValue || size || "";
    const unit = volumeUnit || "ถุง";
    const brandName = brand || "ไม่ระบุ";
    const prodName = productName || name || `${brandName} ${val}${unit}`;

    const newProduct = {
      id: "prod-" + Date.now(),
      name: prodName,
      brand: brandName,
      size: `${val} ${unit}`.trim() || "ไม่ระบุ",
      volumeValue: val ? Number(val) : null,
      volumeUnit: unit,
      price: Number(price) || 0,
      stock: Number(stock || quantity) || 0,
      quantity: Number(stock || quantity) || 0,
      expDate: expDate || "ไม่ระบุหมดอายุ"
    };

    productsList.unshift(newProduct);
    console.log("✅ เพิ่มสินค้าสำเร็จ:", newProduct);

    res.json({ status: "success", data: newProduct });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});