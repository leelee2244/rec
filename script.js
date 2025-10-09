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
 * ★★★ 修正: 画像処理の完了を待ってから保存する ★★★
 */
form.onsubmit = async (e) => {
    e.preventDefault(); // デフォルトのフォーム送信を停止
    
    // 保存ボタンを一時的に無効化して二重送信を防ぎ、処理中であることを示す
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = "保存中...";

    const data = new FormData(form);
    const recipe = Object.fromEntries(data.entries());

    recipe.ingredients = recipe.ingredients.split("\n").filter(Boolean);
    recipe.tags = recipe.tags.split(",").map(t => t.trim()).filter(Boolean);
    
    recipe.rating = Number(recipe.rating); 

    // ★★★ 非同期関数 getImages の完了を await で待つ ★★★
    recipe.images = await getImages(fImages.files);
    
    if (editingIndex !== null) {
        const existing = recipes[editingIndex];
        recipe.created = existing.created;
        recipe.formattedDate = existing.formattedDate;
        recipe.cookedCount = existing.cookedCount || 0;
    }

    saveRecipe(recipe);

    // 処理が完了したらボタンを元に戻す
    saveButton.disabled = false;
    saveButton.textContent = "保存";
};

// ==========================================================
// 2. データ処理関数
// ==========================================================

/**
 * 画像ファイルをBase64文字列に変換する非同期関数
 * ★★★ 修正: Promiseの解決を確実にする ★★★
 */
async function getImages(files) {
    if (files.length === 0) return [];
    
    // Promise.all を使用して全ての画像の読み込みを並行処理し、完了を待つ
    return Promise.all(
        Array.from(files).map(file => {
            return new Promise((resolve, reject) => { // rejectも追加
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error); // エラー処理も追加
                reader.readAsDataURL(file);
            });
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
    if (r.images && r.images.length > 0) { // r.imagesがnull/undefinedの場合も考慮
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
    // モーダルを閉じる際に、保存ボタンの状態もリセットする
    const saveButton = form.querySelector('button[type="submit"]');
    saveButton.disabled = false;
    saveButton.textContent = "保存";
}

// アプリ起動時の初期描画
render();
