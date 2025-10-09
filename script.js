let recipes = JSON.parse(localStorage.getItem("recipes") || "[]");
let editingIndex = null;

// DOM
const list = document.getElementById("list");
const modal = document.getElementById("modal");
const form = document.getElementById("recipeForm");
const fImages = document.getElementById("fImages");
const imagePreview = document.getElementById("imagePreview");
const inputSearch = document.getElementById("inputSearch");
const selectSort = document.getElementById("selectSort");
const fRating = document.getElementById("fRating"); 

// ==========================================================
// ==========================================================

document.getElementById("btnNew").addEventListener("click", () => openModal());
document.getElementById("btnCancel").addEventListener("click", closeModal);

inputSearch.addEventListener("input", render);
selectSort.addEventListener("change", render);

/**
 */
form.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const recipe = Object.fromEntries(data.entries());

    recipe.ingredients = recipe.ingredients.split("\n").filter(Boolean);
    recipe.tags = recipe.tags.split(",").map(t => t.trim()).filter(Boolean);
    
    recipe.rating = Number(recipe.rating); 

    recipe.images = await getImages(fImages.files);
    
    if (editingIndex !== null) {
        const existing = recipes[editingIndex];
        recipe.created = existing.created;
        recipe.formattedDate = existing.formattedDate;
        recipe.cookedCount = existing.cookedCount || 0; 
    }

    saveRecipe(recipe);
};

// ==========================================================
// ==========================================================

/**
 * 
 */
async function getImages(files) {
    if (files.length === 0) return [];
    
    return Promise.all(
        Array.from(files).map(file => {
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        })
    );
}

/**
 */
function saveRecipe(recipe) {
    if (editingIndex !== null) {
        recipes[editingIndex] = recipe;
        editingIndex = null;
    } else {
        const now = Date.now();
        recipe.created = now;
        // 登録日時と作った回数を追加
        recipe.formattedDate = new Date(now).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
        recipe.cookedCount = 0; //
        recipes.unshift(recipe);
    }
    localStorage.setItem("recipes", JSON.stringify(recipes));
    render();
    closeModal();
}

/**
 * 回数増
 */
function increaseCookCount(index) {
    recipes[index].cookedCount = (recipes[index].cookedCount || 0) + 1;
    localStorage.setItem("recipes", JSON.stringify(recipes));
    render();
}

/**
 
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
  
    // 編集で画像表示
    imagePreview.innerHTML = "";
    if (r.images) {
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
 * 小数点評価
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
// ==========================================================

/**
 
 */
function render() {
    let filteredRecipes = [...recipes]; 

    // 検索
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
        
        
        /*
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
        */
        
        const title = document.createElement("h3");
        title.textContent = r.title;
        const tags = document.createElement("div");
        tags.textContent = r.tags.join(", ");
        tags.style.color = "#777";
        
        
        const rating = document.createElement("div");
        rating.textContent = formatRating(r.rating) || "評価なし";
        
        // 登録日時と作った回数を表示する要素の追加
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
        
        // 「作った」ボタン
        const cookBtn = document.createElement("button");
        cookBtn.textContent = "🍴 作った";
        cookBtn.className = "icon-btn";
        cookBtn.addEventListener("click", () => increaseCookCount(originalIndex));


        // 編集ボタンのイベント
        const edit = document.createElement("button");
        edit.textContent = "✏️";
        edit.className = "icon-btn";
        edit.addEventListener("click", () => editRecipe(originalIndex));

        // 削除ボタンのイベント
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
}

// アプリ起動時の初期描画
render();