let recipes = JSON.parse(localStorage.getItem("recipes") || "[]");
let editingIndex = null;

// DOM要素の取得
const list = document.getElementById("list");
const modal = document.getElementById("modal");
const form = document.getElementById("recipeForm");
const fImages = document.getElementById("fImages");
const imagePreview = document.getElementById("imagePreview");
const inputSearch = document.getElementById("inputSearch");
const selectSort = document.getElementById("selectSort");
const fRating = document.getElementById("fRating"); 

// ==========================================================
// 1. 初期化とイベントリスナーの設定
// ==========================================================

document.getElementById("btnNew").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);

inputSearch.addEventListener("input", render);
selectSort.addEventListener("change", render);

/**
 * フォーム送信処理 (非同期化)
 */
form.onsubmit = async (e) => {
    e.preventDefault(); 
    
    const saveButton = form.querySelector('button[type="submit"]');
    
    try {
        // 処理開始
        saveButton.disabled = true;
        saveButton.textContent = "保存中...";

        const data = new FormData(form);
        const recipe = Object.fromEntries(data.entries());

        recipe.ingredients = recipe.ingredients.split("\n").filter(Boolean);
        recipe.tags = recipe.tags.split(",").map(t => t.trim()).filter(Boolean);
        
        recipe.rating = Number(recipe.rating); 

        // ★★★ 修正: リサイズ処理を含む getImages の完了を待つ ★★★
        recipe.images = await getImages(fImages.files);
        
        if (editingIndex !== null) {
            const existing = recipes[editingIndex];
            recipe.created = existing.created;
            recipe.formattedDate = existing.formattedDate;
            recipe.cookedCount = existing.cookedCount || 0;
        }

        saveRecipe(recipe);
        
    } catch (error) {
        // エラー発生時の処理（フリーズ防止）
        console.error("レシピ保存中にエラーが発生しました:", error);
        alert("レシピの保存に失敗しました。\n画像の読み込みまたはリサイズ処理でエラーが発生しました。");
        
    } finally {
        // 処理終了（エラーの有無に関わらずボタンをリセット）
        saveButton.disabled = false;
        saveButton.textContent = "保存";
    }
};

// ==========================================================
// 2. データ処理関数
// ==========================================================

/**
 * 画像をリサイズし、Base64形式で返す非同期関数 (新規追加)
 * この関数が画像を縮小し、保存データ量を減らします。
 */
function resizeImageAndGetBase64(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 最大幅を超えていたらリサイズ
                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // JPEG形式、圧縮率0.8でBase64文字列に変換して解決
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = (error) => reject(new Error("画像読み込みエラー (Image Element)"));
            img.src = event.target.result;
        };
        reader.onerror = (error) => reject(new Error("ファイル読み込みエラー (FileReader)"));
        reader.readAsDataURL(file);
    });
}


/**
 * 画像ファイルをBase64文字列に変換する非同期関数 (リサイズ関数を呼び出すように変更)
 */
async function getImages(files) {
    if (files.length === 0) return [];
    
    return Promise.all(
        Array.from(files).map(file => {
            // ★★★ resizeImageAndGetBase64 を呼び出す ★★★
            return resizeImageAndGetBase64(file, 800);
        })
    );
}

/**
 * レシピを保存・更新し、LocalStorageを更新する
 */
function saveRecipe(recipe) {
    if (editingIndex !== null) {
        recipes[editingIndex] = recipe;
        editingIndex = null;
    } else {
        const now = Date.now();
        recipe.created = now;
        recipe.formattedDate = new Date(now).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
        recipe.cookedCount = 0;
        recipes.unshift(recipe);
    }
    localStorage.setItem("recipes", JSON.stringify(recipes));
    render();
    closeModal();
}

/**
 * 作った回数を増やす関数
 */
function increaseCookCount(index) {
    recipes[index].cookedCount = (recipes[index].cookedCount || 0) + 1;
    localStorage.setItem("recipes", JSON.stringify(recipes));
    render();
}

/**
 * レシピを編集モーダルに読み込む
 */
function editRecipe(index) {
    const r = recipes[index];
    editingIndex = index;

    document.getElementById("modalTitle").textContent = "レシピを編集";
    form.fTitle.value = r.title;
    fRating.value = r.rating; 
    form.fIngredients.value = r.ingredients.join("\n");
    form.fSteps.value = r.steps;
    form.fTags.value = r.tags.join(", ");
    
    imagePreview.innerHTML = "";
    if (r.images && r.images.length > 0) { 
        r.images.forEach(src => {
            const img = document.createElement("img");
            img.src = src;
            imagePreview.appendChild(img);
        });
    }
    fImages.value = null; 
    openModal();
}

/**
 * 小数点評価を星マーク文字列に変換するヘルパー関数
 */
function formatRating(value) {
    const fullStar = '★';
    const emptyStar = '☆';
    
    if (value === 0 || !value) return '';
    
    const ratingValue = Math.min(parseFloat(value), 5.0).toFixed(1);
    const full = Math.floor(ratingValue);
    const empty = 5 - full;

    return `${fullStar.repeat(full)}${emptyStar.repeat(empty)} (${ratingValue} / 5.0)`;
}

// ==========================================================
// 3. 表示 (レンダリング) とロジック
// ==========================================================

/**
 * レシピリストをフィルタリング、ソートして描画する
 */
function render() {
    let filteredRecipes = [...recipes]; 

    const searchTerm = inputSearch.value.toLowerCase();
    if (searchTerm) {
        filteredRecipes = filteredRecipes.filter(r => {
            const searchableText = [
                r.title,
                r.steps,
                r.ingredients.join(" "),
                r.tags.join(" ")
            ].join(" ").toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    const sortValue = selectSort.value;
    filteredRecipes.sort((a, b) => {
        if (sortValue === "recommended") {
            return b.rating - a.rating;
        } else if (sortValue === "newest") {
            return b.created - a.created;
        } else if (sortValue === "title") {
            return a.title.localeCompare(b.title, 'ja');
        }
        return 0;
    });

    list.innerHTML = "";
    filteredRecipes.forEach((r) => { 
        const originalIndex = recipes.findIndex(rec => rec.created === r.created);

        const card = document.createElement("div");
        card.className = "card";
        
        // ★★★ レシピ一覧に画像を再表示するロジック ★★★
        if (r.images?.length) {
            const imgs = document.createElement("div");
            imgs.className = "card-images";
            r.images.forEach(src => {
                const img = document.createElement("img");
                img.src = src;
                imgs.appendChild(img);
            });
            card.appendChild(imgs);
        }
        
        const title = document.createElement("h3");
        title.textContent = r.title;
        const tags = document.createElement("div");
        tags.textContent = r.tags.join(", ");
        tags.style.color = "#777";
        
        const rating = document.createElement("div");
        rating.textContent = formatRating(r.rating) || "評価なし";
        
        const meta = document.createElement("div");
        meta.className = "card-meta";
        const cookedCount = r.cookedCount || 0;
        meta.innerHTML = `
            登録日: ${r.formattedDate || '不明'} 
            <span class="dot-separator">・</span> 
            作った回数: ${cookedCount}回
        `;

        const btns = document.createElement("div");
        btns.className = "card-buttons";
        
        const cookBtn = document.createElement("button");
        cookBtn.textContent = "🍴 作った！";
        cookBtn.className = "icon-btn";
        cookBtn.addEventListener("click", () => increaseCookCount(originalIndex));

        const edit = document.createElement("button");
        edit.textContent = "✏️";
        edit.className = "icon-btn";
        edit.addEventListener("click", () => editRecipe(originalIndex));

        const del = document.createElement("button");
        del.textContent = "🗑️";
        del.className = "icon-btn";
        del.addEventListener("click", () => {
            if (confirm(`「${r.title}」を削除しますか？`)) {
                recipes.splice(originalIndex, 1);
                localStorage.setItem("recipes", JSON.stringify(recipes));
                render();
            }
        });

        btns.append(cookBtn, edit, del);
        card.append(title, rating, tags, meta, btns); 
        list.appendChild(card);
    });
}

// ==========================================================
// 4. モーダル操作関数
// ==========================================================

function openModal() {
    modal.classList.add("show");
}

function closeModal() {
    modal.classList.remove("show");
    form.reset();
    imagePreview.innerHTML = "";
    document.getElementById("modalTitle").textContent = "レシピを追加";
    editingIndex = null;
    
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = false;
    saveButton.textContent = "保存";
}

// アプリ起動時の初期描画
render();
