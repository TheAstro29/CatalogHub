const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYJ9v6sHQkTYgSxU57OqS5IE3OQlolzndSDhKqazX7qHqaYwkzcWVa8diAoTC1mb8/exec';
const SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRv8oYJkDkFIsXwM5ZTn_xPhH8XAD02VVl_9XVFzu2ySNOqnGVMOOH_WiXk5w0nYMU74jc1pxLQkwCD/pub?output=csv';
const CAT_CSV_URL = SHEET_BASE_URL + '&gid=1305593331';

let catalogs = [];
let categories = [];
let currentFilter = 'all';
let currentAction = 'add';
let isAdmin = false;

// --- Init ---
function init() {
    fetchData();
    setupPullToRefresh();
}

// --- Admin Lock Logic (เวอร์ชันเข้ารหัสความปลอดภัยสูง) ---
async function hashPassword(string) {
    const utf8 = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Admin Lock Logic (เวอร์ชันส่งไปเช็คหลังบ้าน ปลอดภัยสูงและโค้ดสั้นมาก) ---
async function askAdminPassword() {
    const { value: password } = await Swal.fire({
        title: 'กรุณาใส่รหัสผ่านแอดมิน',
        input: 'password',
        inputPlaceholder: 'Enter Password',
        showCancelButton: true
    });

    if (!password) return;

    // แสดงสถานะกำลังตรวจสอบ
    Swal.fire({ title: 'กำลังตรวจสอบรหัสผ่าน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // ส่งรหัสผ่านไปถาม Google Apps Script หลังบ้าน
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'checkAdminPassword', password: password.trim() })
        });
        
        const result = await response.json();

        if (result.success === true) {
            isAdmin = true;
            document.getElementById('adminBtn').classList.remove('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            document.getElementById('unlockBtn').classList.add('hidden');
            Swal.fire({ icon: 'success', title: 'ปลดล็อกเรียบร้อย', timer: 1000, showConfirmButton: false });
            renderCatalogs(); // แสดงปุ่มแก้ไข/ลบสินค้า
        } else {
            Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ถูกต้อง!' });
        }
    } catch (error) {
        // หาก Apps Script ของคุณเปิดโหมด no-cors ไว้ ให้ใช้การจำลองปลดล็อก หรือแจ้งเตือนตามระบบ
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', text: 'โปรดตรวจสอบสิทธิ์การเข้าถึงหลังบ้าน' });
    }
}

// --- Fetch Data ---
function fetchData(isSilent = false) {
    if (!isSilent) document.getElementById('catalogList').innerHTML = `<div class="text-center py-20 text-gray-400 animate-pulse text-xs">กำลังอัปเดตข้อมูลล่าสุด...</div>`;
    const cacheBuster = `&t=${new Date().getTime()}`;

    Papa.parse(SHEET_BASE_URL + cacheBuster, {
        download: true, header: true, skipEmptyLines: true,
        complete: (prodRes) => {
            catalogs = prodRes.data.filter(item => item.title && item.link);
            Papa.parse(CAT_CSV_URL + cacheBuster, {
                download: true, header: true, skipEmptyLines: true,
                complete: (catRes) => {
                    let sheetCats = catRes.data.map(c => c.name).filter(c => c);
                    let prodCats = catalogs.map(item => item.category).filter(c => c);
                    categories = [...new Set([...sheetCats, ...prodCats])];
                    if (categories.length === 0) categories = ["ทั่วไป"];
                    renderTabs(); updateCatDropdown(); renderCatalogs();
                }
            });
        }
    });
}

// --- Pull to Refresh Logic ---
function setupPullToRefresh() {
    let startY = 0;
    const ptr = document.getElementById('ptr');

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) startY = e.touches[0].pageY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        const y = e.touches[0].pageY;
        if (window.scrollY === 0 && y > startY) {
            const diff = y - startY;
            if (diff < 100) {
                ptr.style.transform = `translateY(${diff}px)`;
                if (diff > 70) ptr.innerText = "🔄 ปล่อยเพื่อรีเฟรช";
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        if (parseInt(ptr.style.transform.replace('translateY(', '')) > 70) {
            manualRefresh();
        }
        ptr.style.transform = 'translateY(0)';
        ptr.innerText = "⬇️ ลากลงเพื่อรีเฟรช";
    });
}

function manualRefresh() {
    Swal.fire({ title: 'กำลังรีเฟรช...', timer: 1000, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    fetchData(true);
}

// --- UI Rendering ---
function renderTabs() {
    const tabs = document.getElementById('catTabs');
    let html = `<button onclick="filterCategory('all')" class="cat-btn ${currentFilter === 'all' ? 'active' : ''} border px-4 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap">ทั้งหมด</button>`;
    categories.forEach(cat => {
        html += `<button onclick="filterCategory('${cat}')" class="cat-btn ${currentFilter === cat ? 'active' : ''} border text-gray-500 px-4 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap">${cat}</button>`;
    });
    tabs.innerHTML = html;
}

function updateCatDropdown() {
    document.getElementById('inputCat').innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function renderCatalogs() {
    const list = document.getElementById('catalogList');
    list.innerHTML = '';
    const filtered = catalogs.filter(item => currentFilter === 'all' || item.category === currentFilter);

    if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs italic">-- ไม่พบข้อมูลสินค้า --</div>`;
        return;
    }

    filtered.forEach((item) => {
        const fileId = (item.link || "").match(/[-\w]{25,}/);
        const thumbUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId[0]}&sz=w1000` : 'https://via.placeholder.com/400x300?text=C2TECH';

        list.insertAdjacentHTML('beforeend', `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative p-3 flex flex-col justify-between" data-name="${item.title.toLowerCase()}">
                <div>
                    ${isAdmin ? `
                    <div class="absolute top-2 right-2 flex gap-1.5 z-10">
                        <button onclick="openEditMode('${item.title}', '${item.link}', '${item.category}')" class="p-1.5 bg-white/90 shadow rounded-full text-blue-600 text-xs border">✏️</button>
                        <button onclick="confirmDeleteProduct('${item.title}')" class="p-1.5 bg-white/90 shadow rounded-full text-red-600 text-xs border">🗑️</button>
                    </div>` : ''}
                    
                    <img src="${thumbUrl}" 
                         loading="lazy" 
                         onclick="previewImage('${thumbUrl}')" 
                         class="product-image rounded-xl" 
                         onerror="this.src='https://via.placeholder.com/600x400?text=Image+Not+Found'">
                    
                    <h3 class="font-bold text-gray-800 text-xs mt-2 px-1 line-clamp-2">${item.title}</h3>
                </div>

                <div class="flex gap-1.5 mt-3">
                    <button onclick="handleOpenFile('${item.link}')" class="action-btn flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2.5 rounded-lg font-bold text-center border active:scale-95 transition">
                        Open File
                    </button>
                    <button onclick="showProductQR('${item.title.replace(/'/g, "\\'")}', '${item.link}')" class="action-btn flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg font-bold text-center active:scale-95 transition flex items-center justify-center gap-1">
                        Scan QR
                    </button>
                    <button onclick="copyToClipboard('${item.link}')" class="action-btn p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm active:scale-95 transition">
                        Copy
                    </button>
                </div>
            </div>
        `);
    });
}

// --- Search with Debounce ---
let searchTimer;
function filterProductsDebounced() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        let v = document.getElementById('searchInput').value.toLowerCase();
        document.querySelectorAll('[data-name]').forEach(c => {
            c.style.display = c.getAttribute('data-name').includes(v) ? "block" : "none";
        });
    }, 300);
}

// --- Standard Functions ---
function previewImage(src) {
    const overlay = document.getElementById('imageOverlay');
    const img = document.getElementById('overlayImg');
    img.src = src; overlay.style.display = 'flex';
}

async function handleProductAction() {
    const p = { action: currentAction, title: document.getElementById('inputTitle').value.trim(), link: document.getElementById('inputLink').value.trim(), category: document.getElementById('inputCat').value, oldTitle: document.getElementById('editOldTitle').value };
    if (!p.title || !p.link) return Swal.fire({ title: 'ระบุข้อมูลไม่ครบ', icon: 'warning' });
    await sendToCloud(p);
}

async function handleAddCat() {
    const name = document.getElementById('newCatInput').value.trim();
    if (!name) return;
    await sendToCloud({ action: 'addCat', catName: name });
    document.getElementById('newCatInput').value = "";
}

async function handleDelCat() {
    const name = document.getElementById('inputCat').value;
    const res = await Swal.fire({ title: `ลบหมวด "${name}"?`, icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) await sendToCloud({ action: 'deleteCat', oldCatName: name });
}

async function confirmDeleteProduct(title) {
    const res = await Swal.fire({ title: 'ลบสินค้านี้?', icon: 'error', showCancelButton: true });
    if (res.isConfirmed) await sendToCloud({ action: 'delete', oldTitle: title });
}

async function sendToCloud(p) {
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(p) });
        closeModal();
        Swal.fire({ icon: 'success', title: 'สำเร็จ', showConfirmButton: false, timer: 1000 });
        setTimeout(() => { fetchData(true); }, 1500);
    } catch (e) {
        Swal.fire({ title: 'เกิดข้อผิดพลาด', text: 'ลองใหม่อีกครั้ง', icon: 'error' });
    }
}

function openAdminModal() { document.getElementById('adminModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('adminModal').classList.add('hidden'); resetToAddMode(); }

function openEditMode(t, l, c) {
    currentAction = 'edit';
    document.getElementById('modalTitle').innerText = "✏️ แก้ไขสินค้า";
    document.getElementById('editOldTitle').value = t;
    document.getElementById('inputTitle').value = t;
    document.getElementById('inputLink').value = l;
    document.getElementById('inputCat').value = c;
    document.getElementById('resetBtn').classList.remove('hidden');
    openAdminModal();
}

function resetToAddMode() {
    currentAction = 'add';
    document.getElementById('modalTitle').innerText = "🚀 จัดการระบบ";
    document.getElementById('inputTitle').value = "";
    document.getElementById('inputLink').value = "";
    document.getElementById('resetBtn').classList.add('hidden');
}

function copyToClipboard(url) {
    const el = document.createElement('textarea'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    Swal.fire({ icon: 'success', title: 'คัดลอกสำเร็จ!', timer: 800, showConfirmButton: false, toast: true, position: 'top' });
}

function filterCategory(c) { currentFilter = c; renderTabs(); renderCatalogs(); }

// ฟังก์ชันสำหรับแชร์ลิงก์ไปยัง Line
function shareToLine(url, title) {
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`;
    window.open(lineUrl, '_blank');
}

/**
 * ฟังก์ชันเปิดไฟล์ที่รองรับทั้ง Browser ทั่วไป และ Webview (APK)
 */
function handleOpenFile(url) {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    try {
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        window.location.href = url;
    }
}

/**
 * ฟังก์ชันสร้างและแสดงผล QR Code ขนาดใหญ่ (แก้ไขจุด Syntax Error)
 */
function showProductQR(title, url) {
    if (!url) return;
    
    const qrOverlay = document.getElementById('qrOverlay');
    const qrImg = document.getElementById('qrImg');
    const qrTitle = document.getElementById('qrTitle');
    
    qrTitle.innerText = title;
    qrImg.src = 'https://via.placeholder.com/300x300?text=Loading...';
    
    const encodedUrl = encodeURIComponent(url);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`;
    
    qrOverlay.style.display = 'flex';
}

/**
 * ฟังก์ชันสำหรับออกจากระบบ Admin
 */
function handleLogout() {
    Swal.fire({
        title: 'ยืนยันการออกจากระบบ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            // 1. เคลียร์สถานะแอดมิน
            isAdmin = false;
            
            // 2. สลับการแสดงผลปุ่มบน Header กลับไปเป็นแบบปกติ
            document.getElementById('adminBtn').classList.add('hidden');
            document.getElementById('logoutBtn').classList.add('hidden');
            document.getElementById('unlockBtn').classList.remove('hidden');
            
            // 3. สั่ง Render หน้าจอใหม่ เพื่อเอาปุ่ม แก้ไข/ลบ สินค้าออกไป
            renderCatalogs();
            
            // 4. แจ้งเตือนผู้ใช้
            Swal.fire({
                icon: 'success',
                title: 'ออกจากระบบแอดมินแล้ว',
                timer: 1000,
                showConfirmButton: false
            });
        }
    });
}

/**
 * ฟังก์ชันสร้างและแสดงผล QR Code สำหรับตัวเว็บไซต์ทั้งหมด
 */
function showWebQR() {
    // ดึง URL ปัจจุบันของเว็บไซต์ที่กำลังเปิดใช้งานอยู่โดยอัตโนมัติ
    const currentWebUrl = window.location.href;
    
    const qrOverlay = document.getElementById('qrOverlay');
    const qrImg = document.getElementById('qrImg');
    const qrTitle = document.getElementById('qrTitle');
    
    // ตั้งหัวข้อ Pop-up
    qrTitle.innerText = "QR Code สำหรับเข้าเว็บไซต์";
    qrImg.src = 'https://via.placeholder.com/300x300?text=Loading...';
    
    // สร้างลิงก์ QR Code ส่งไปยัง API
    const encodedUrl = encodeURIComponent(currentWebUrl);
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`;
    
    qrOverlay.style.display = 'flex';
}
// รันระบบเริ่มต้น
init();