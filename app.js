import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========================================================
// 1. FIREBASE CONFIG BILGILERIN
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyAp3b1zWnJ-W3PPBBjuTtYuggXsh5y8wT0",
  authDomain: "anilar-c7c7e.firebaseapp.com",
  projectId: "anilar-c7c7e",
  storageBucket: "anilar-c7c7e.firebasestorage.app",
  messagingSenderId: "183460592548",
  appId: "1:183460592548:web:93ccd03ba1907cb8065f31",
  measurementId: "G-7TD1GCX0BW"
};

// Firebase Başlatma
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ========================================================
// 2. CLOUDINARY BILGILERIN
// ========================================================
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/drtvn73sy/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "anilar_preset";

// HTML Elemanlarını Yakalama
const photoInput = document.getElementById("photo-input");
const noteInput = document.getElementById("note-input");
const saveBtn = document.getElementById("save-btn");
const gallery = document.getElementById("memories-gallery");

// ========================================================
// 3. BULUTA FOTOĞRAF VE NOT YÜKLEME (KAYDETME)
// ========================================================
saveBtn.addEventListener("click", async () => {
  const file = photoInput.files[0];
  const note = noteInput.value.trim();

  if (!file) {
    alert("Lütfen önce bir fotoğraf seç aşkım! 📸");
    return;
  }
  if (!note) {
    alert("Lütfen bu anıya güzel bir not düş! 📝");
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.innerText = "Anınız Buluta Yükleniyor... ⏳";

    // 1. Adım: Fotoğrafı Cloudinary'ye gönderiyoruz
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const cloudinaryResponse = await fetch(CLOUDINARY_URL, {
      method: "POST",
      body: formData
    });

    if (!cloudinaryResponse.ok) {
      throw new Error("Cloudinary yükleme hatası!");
    }

    const cloudinaryData = await cloudinaryResponse.json();
    const yuklenenResimUrl = cloudinaryData.secure_url;

    // 2. Adım: Resim linkini ve notu Firebase Firestore'a kaydediyoruz
    await addDoc(collection(db, "anilar"), {
      imageUrl: yuklenenResimUrl,
      note: note,
      createdAt: serverTimestamp() // Sunucu saatini senkron kullanıyoruz
    });

    alert("Anımız sonsuza kadar kaydedildi! ❤️✨");
    
    // Formu temizle
    photoInput.value = "";
    noteInput.value = "";
    const statusText = document.getElementById("dosya-durum-metni");
    if(statusText) statusText.innerText = "Buraya tıkla veya bir fotoğraf seç...";

  } catch (hata) {
    console.error("Yükleme sırasında bir hata oluştu:", hata);
    alert("Bir sorun oluştu, bilgileri kontrol edip tekrar dene.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "Anıyı Güvenle Kaydet";
  }
});

// ========================================================
// 4. GERÇEK ZAMANLI (REALTIME) ANILARI LİSTELEME
// ========================================================
// onSnapshot sayesinde sayfayı yenilediğinde veya yeni veri geldiğinde bekleme/takılma olmaz
const sorgu = query(collection(db, "anilar"), orderBy("createdAt", "desc"));

onSnapshot(sorgu, (querySnapshot) => {
  gallery.innerHTML = ""; // Galeriyi temizle

  if (querySnapshot.empty) {
    gallery.innerHTML = "<p style='color: #888; text-align:center; width:100%;'>Henüz hiç anı eklenmemiş. İlk anıyı sen bırak!</p>";
    return;
  }

  querySnapshot.forEach((documentSnapshot) => {
    const veri = documentSnapshot.data();
    const docId = documentSnapshot.id;
    // Eğer tarih sunucudan henüz dönmediyse yerel saati bas, döndüyse dönüştür
    const tarihStr = veri.createdAt ? veri.createdAt.toDate().toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');

    const kartHTML = `
      <div class="memory-card" data-id="${docId}">
        <button class="ani-sil-btn" title="Bu anıyı sil">✖</button>
        <img src="${veri.imageUrl}" alt="Anı Fotoğrafı">
        <p>${veri.note}</p>
        <small>📅 ${tarihStr}</small>
      </div>
    `;
    gallery.innerHTML += kartHTML;
  });
}, (hata) => {
  console.error("Anılar yüklenirken hata oluştu: ", hata);
});

// ========================================================
// 5. FOTOĞRAFLARI TAM EKRAN AÇMA VE KAPATMA MANTIĞI
// ========================================================
const modal = document.getElementById("tam-ekran-modal");
const modalImg = document.getElementById("tam-ekran-resim");
const kapatButonu = document.querySelector(".modal-kapat");

if (gallery) {
  gallery.addEventListener("click", (e) => {
    if (e.target.tagName === "IMG") {
      modal.style.display = "flex";
      modalImg.src = e.target.src;
    }
  });
}

if (kapatButonu) {
  kapatButonu.addEventListener("click", () => {
    modal.style.display = "none";
  });
}

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}

// ========================================================
// 6. ANIYI VERİTABANINDAN SİLME MANTIĞI
// ========================================================
if (gallery) {
  gallery.addEventListener("click", async (e) => {
    if (e.target.classList.contains("ani-sil-btn")) {
      e.stopPropagation();
      
      const onay = confirm("Bu güzel anıyı silmek istediğinden emin misin? 🥺");
      if (!onay) return;

      const kart = e.target.closest(".memory-card");
      const docId = kart.getAttribute("data-id");

      try {
        const docRef = doc(db, "anilar", docId);
        await deleteDoc(docRef);
        alert("Anı başarıyla silindi! ✨");
      } catch (hata) {
        console.error("Anı silinirken bir hata meydana geldi: ", hata);
        alert("Anı silinirken bir hata oluştu.");
      }
    }
  });
}