const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔗 ลิงก์เชื่อมต่อ MongoDB Atlas (อย่าลืมใส่รหัสผ่านจริงของคุณแทน <db_password>)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://tanapatledbb_db_user:WkHy66Js3KJaxyBR@cluster0.u8ymxsf.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('🟢 MongoDB Connected Successfully!'))
  .catch(err => console.error('🔴 MongoDB Connection Error:', err));

// 📦 Schema โครงสร้างสินค้า
const productSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  volume: String,
  totalQty: Number,
  remainingQty: Number,
  importDate: String,
  expDate: String,
  costPrice: Number,
  suggestedPrice: Number,
  note: String,
  barcode: String,
  imageUrl: String,
  lotNo: String,
  unit: { type: String, default: 'ถุง' }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// 🚀 API Routes
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = products.map(p => {
      let diffDays = '-';
      if (p.expDate) {
        const exp = new Date(p.expDate);
        exp.setHours(0, 0, 0, 0);
        if (!isNaN(exp.getTime())) {
          diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        }
      }
      return {
        rowIndex: p._id.toString(),
        brand: p.brand || '',
        volume: p.volume || '',
        totalQty: p.totalQty || 0,
        remainingQty: p.remainingQty !== undefined ? p.remainingQty : p.totalQty,
        importDate: p.importDate || '',
        expDate: p.expDate || '',
        costPrice: p.costPrice || 0,
        suggestedPrice: p.suggestedPrice || 0,
        note: p.note || '',
        barcode: p.barcode || '',
        imageUrl: p.imageUrl || '',
        lotNo: p.lotNo || '',
        unit: p.unit || 'ถุง',
        daysLeft: diffDays
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { action, rowIndex, ...data } = req.body;

    if (action === 'add') {
      const newProduct = new Product({
        ...data,
        remainingQty: data.totalQty
      });
      await newProduct.save();
    } else if (action === 'edit') {
      await Product.findByIdAndUpdate(rowIndex, data);
    } else if (action === 'deduct') {
      const p = await Product.findById(rowIndex);
      if (p) {
        p.remainingQty = Math.max(0, p.remainingQty - (req.body.deductQty || 1));
        await p.save();
      }
    } else if (action === 'delete') {
      await Product.findByIdAndDelete(rowIndex);
    }

    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// API รับรูปถ่ายซองอาหาร แล้วส่งให้ Gemini AI อ่านข้อมูล
app.post('/api/scan-bag', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ status: 'error', message: 'กรุณาส่งรูปภาพ' });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      โปรดวิเคราะห์รูปภาพซองอาหารสัตว์นี้ แล้วดึงข้อมูลออกมาในรูปแบบ JSON ภาษาไทย/อังกฤษ ดังนี้:
      1. "brand": ชื่อแบรนด์ หรือ ยี่ห้อสินค้าหลักบนซอง (เช่น SmartHeart, Royal Canin, Pedigree, Whiskas, Me-O)
      2. "volumeValue": ตัวเลขระบุขนาดหรือน้ำหนักบรรจุ เช่น 500, 1.2, 3, 10 (ตอบเฉพาะตัวเลข)
      3. "volumeUnit": หน่วยของขนาด เลือกระหว่าง "g", "kg", "ml", "L", "ชิ้น" (ถ้าไม่แน่ใจให้ใช้ "kg")

      ตัวอย่างโครงสร้างผลลัพธ์:
      {
        "brand": "SmartHeart",
        "volumeValue": 1.2,
        "volumeUnit": "kg"
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
    res.status(500).json({ status: 'error', message: 'ไม่สามารถประมวลผลรูปภาพได้' });
  }
});