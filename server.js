const API_URL = 'https://magma-market-api.onrender.com/api';

document.addEventListener('DOMContentLoaded', fetchProducts);

// 1. ดึงรายการสินค้า
async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    renderProducts(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    document.getElementById('productList').innerHTML = '<div class="empty-state">ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</div>';
  }
}

// 2. แสดงผลการ์ดสินค้า
function renderProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายการสินค้าในระบบ</div>';
    return;
  }

  container.innerHTML = products.map(item => `
    <div class="product-card" id="product-card-${item.id}">
      <div class="product-info">
        <h3>${item.brand && item.brand !== '-' ? item.brand : 'ไม่ระบุยี่ห้อ'}</h3>
        <p><strong>ชื่อ:</strong> ${item.name || 'ไม่ระบุ'}</p>
        <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
        <p><strong>คงเหลือ:</strong> ${item.stock ?? 0} ถุง</p>
        <p><strong>วันหมดอายุ:</strong> ${item.expDate || 'ไม่ระบุ'}</p>
      </div>
      <div style="margin-top: 15px; text-align: right;">
        <button class="btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบรายการ</button>
      </div>
    </div>
  `).join('');
}

// 3. บันทึกสินค้าใหม่
async function saveProduct(event) {
  event.preventDefault();

  const productData = {
    brand: document.getElementById('brand').value,
    name: document.getElementById('name').value,
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    stock: document.getElementById('stock').value,
    expDate: document.getElementById('expDate').value
  };

  try {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    const result = await res.json();

    if (result.status === 'success') {
      alert('บันทึกสินค้าเรียบร้อย!');
      document.getElementById('productForm').reset();
      fetchProducts();
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.message);
    }
  } catch (err) {
    console.error('Save Error:', err);
    alert('ไม่สามารถบันทึกข้อมูลได้');
  }
}

// 4. ลบสินค้าตาม ID (ไม่กระพริบ)
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบรายการนี้ใช่หรือไม่?')) return;

  try {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.status === 'success') {
      const card = document.getElementById(`product-card-${id}`);
      if (card) card.remove();

      const container = document.getElementById('productList');
      if (container && container.children.length === 0) {
        container.innerHTML = '<div class="empty-state">ยังไม่มีรายการสินค้าในระบบ</div>';
      }
    } else {
      alert('ลบไม่สำเร็จ: ' + result.message);
    }
  } catch (err) {
    console.error('Delete Error:', err);
    alert('เกิดข้อผิดพลาดในการลบรายการ');
  }
}