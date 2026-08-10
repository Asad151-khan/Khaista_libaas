/**
 * KHAISTA LIBAAS - E-Commerce Application & WhatsApp Direct Ordering Logic
 * Owner Sale Controller & Cart State Management
 */

// App State
let state = {
  products: [...INITIAL_PRODUCTS],
  cart: JSON.parse(localStorage.getItem('khaista_cart')) || [],
  wishlist: JSON.parse(localStorage.getItem('khaista_wishlist')) || [],
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'featured',
  ownerSale: JSON.parse(localStorage.getItem('khaista_owner_sale')) || {
    activePreset: 50, // Default 50% OFF sale active as requested by user!
    customCategorySales: {}
  },
  selectedProductForModal: null,
  selectedSize: 'Medium'
};

const WHATSAPP_NUMBER = "923439294699"; // Format for WhatsApp API: 03439294699

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  applyOwnerSalePricing();
  renderProducts();
  updateCartBadge();
  setupEventListeners();
  checkFreeShippingProgress();
}

// 1. Owner Sale Controller Logic
function applyOwnerSalePricing() {
  const { activePreset, customCategorySales } = state.ownerSale;
  
  state.products = INITIAL_PRODUCTS.map(product => {
    let discount = product.discountPercent; // Default discount
    
    // Global active preset overrides if set
    if (activePreset !== null && activePreset !== undefined) {
      discount = activePreset;
    } else if (customCategorySales[product.category] !== undefined) {
      discount = customCategorySales[product.category];
    }
    
    const finalPrice = Math.round(product.price * (1 - discount / 100));
    
    return {
      ...product,
      effectiveDiscount: discount,
      finalPrice: finalPrice
    };
  });
}

function setGlobalOwnerSale(percent) {
  state.ownerSale.activePreset = percent;
  localStorage.setItem('khaista_owner_sale', JSON.stringify(state.ownerSale));
  
  applyOwnerSalePricing();
  renderProducts();
  renderCartDrawer();
  
  showToast(percent > 0 ? `🔥 Flat ${percent}% OFF Sale Applied Storewide!` : `Sale Cleared - Standard Prices Active`);
  closeOwnerModal();
}

// 2. Render Products Grid
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  
  let filtered = state.products.filter(p => {
    const matchesCategory = state.activeCategory === 'all' || 
      (state.activeCategory === 'sale' ? p.effectiveDiscount > 0 : p.category === state.activeCategory);
    
    const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      p.fabric.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      p.color.toLowerCase().includes(state.searchQuery.toLowerCase());
      
    return matchesCategory && matchesSearch;
  });
  
  // Apply Sorting
  if (state.sortBy === 'price-low') {
    filtered.sort((a, b) => a.finalPrice - b.finalPrice);
  } else if (state.sortBy === 'price-high') {
    filtered.sort((a, b) => b.finalPrice - a.finalPrice);
  } else if (state.sortBy === 'discount-high') {
    filtered.sort((a, b) => b.effectiveDiscount - a.effectiveDiscount);
  }
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
        <i class="fa-solid fa-shirt" style="font-size: 3rem; color: var(--primary-gold); margin-bottom: 16px;"></i>
        <h3 style="font-size: 1.5rem;">No items found</h3>
        <p style="color: var(--text-muted);">Try resetting your search query or filter tab.</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(product => {
    const hasDiscount = product.effectiveDiscount > 0;
    const isWishlisted = state.wishlist.includes(product.id);
    
    return `
      <div class="product-card">
        <div class="product-image-box">
          ${hasDiscount ? `<span class="badge-sale">FLAT ${product.effectiveDiscount}% OFF</span>` : ''}
          ${product.isNew ? `<span class="badge-new">NEW ARRIVAL</span>` : ''}
          
          <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy" />
          
          <div class="product-actions-overlay">
            <button class="quick-action-btn" onclick="openQuickView('${product.id}')">
              <i class="fa-regular fa-eye"></i> Quick View
            </button>
            <button class="quick-action-btn" onclick="toggleWishlist('${product.id}')" style="${isWishlisted ? 'color: #c0392b;' : ''}">
              <i class="fa-${isWishlisted ? 'solid' : 'regular'} fa-heart"></i>
            </button>
          </div>
        </div>
        
        <div class="product-info-box">
          <div class="product-category-tag">${product.pieces}</div>
          <h3 class="product-title" onclick="openQuickView('${product.id}')">${product.name}</h3>
          <div class="product-fabric-spec">${product.fabric.substring(0, 50)}...</div>
          
          <div class="price-row">
            <span class="current-price">PKR ${product.finalPrice.toLocaleString()}</span>
            ${hasDiscount ? `<span class="original-price">PKR ${product.price.toLocaleString()}</span>` : ''}
          </div>
          
          <div class="btn-card-group">
            <button class="btn-add-cart" onclick="quickAddToCart('${product.id}')">
              <i class="fa-solid fa-bag-shopping"></i> Add to Cart
            </button>
            <button class="btn-order-wa" onclick="directWhatsAppOrderSingle('${product.id}')">
              <i class="fa-brands fa-whatsapp"></i> Order Now
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 3. Cart State Management
function quickAddToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  const size = product.sizes.includes('Unstitched') ? 'Unstitched' : 'Medium';
  addToCart(productId, size, 1);
}

function addToCart(productId, size, qty = 1) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  const existingIndex = state.cart.findIndex(item => item.id === productId && item.size === size);
  
  if (existingIndex > -1) {
    state.cart[existingIndex].qty += qty;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.finalPrice,
      originalPrice: product.price,
      discountPercent: product.effectiveDiscount,
      image: product.image,
      fabric: product.fabric,
      size: size,
      qty: qty
    });
  }
  
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  openCartDrawer();
  showToast(`Added "${product.name}" to cart!`);
}

function removeFromCart(index) {
  state.cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function updateCartQty(index, delta) {
  state.cart[index].qty += delta;
  if (state.cart[index].qty <= 0) {
    state.cart.splice(index, 1);
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function saveCart() {
  localStorage.setItem('khaista_cart', JSON.stringify(state.cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    badge.innerText = totalItems;
  }
}

function renderCartDrawer() {
  const body = document.getElementById('cart-drawer-body');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const savingsEl = document.getElementById('cart-savings');
  
  if (!body) return;
  
  if (state.cart.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <i class="fa-solid fa-bag-shopping" style="font-size: 3rem; color: var(--border-gold); margin-bottom: 16px;"></i>
        <h4 style="font-size: 1.2rem;">Your cart is currently empty</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 6px;">Explore our luxury lawn & pret collections to add suits.</p>
      </div>
    `;
    if (subtotalEl) subtotalEl.innerText = "PKR 0";
    if (totalEl) totalEl.innerText = "PKR 0";
    if (savingsEl) savingsEl.innerText = "PKR 0";
    return;
  }
  
  let subtotal = 0;
  let totalSavings = 0;
  
  body.innerHTML = state.cart.map((item, idx) => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    totalSavings += (item.originalPrice - item.price) * item.qty;
    
    return `
      <div class="cart-item">
        <img src="${item.image}" class="cart-item-img" alt="${item.name}" />
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">Size: <strong>${item.size}</strong></div>
          <div class="cart-item-bottom">
            <div class="qty-control">
              <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
              <span class="qty-number">${item.qty}</span>
              <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
            </div>
            <div style="font-weight: 700; font-size: 0.95rem;">
              PKR ${itemTotal.toLocaleString()}
            </div>
          </div>
        </div>
        <button onclick="removeFromCart(${idx})" style="color: #c0392b; font-size: 0.9rem; align-self: flex-start;">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');
  
  if (subtotalEl) subtotalEl.innerText = `PKR ${subtotal.toLocaleString()}`;
  if (totalEl) totalEl.innerText = `PKR ${subtotal.toLocaleString()}`;
  if (savingsEl) savingsEl.innerText = `PKR ${totalSavings.toLocaleString()}`;
  
  checkFreeShippingProgress(subtotal);
}

function checkFreeShippingProgress(subtotal = 0) {
  const threshold = 5000;
  const fill = document.getElementById('shipping-fill');
  const text = document.getElementById('shipping-text');
  
  if (!fill || !text) return;
  
  if (subtotal >= threshold) {
    fill.style.width = '100%';
    text.innerHTML = `🎉 Congratulations! You unlocked <strong>FREE Shipping Nationwide</strong>!`;
  } else {
    const percent = Math.min(100, Math.round((subtotal / threshold) * 100));
    const remaining = threshold - subtotal;
    fill.style.width = `${percent}%`;
    text.innerHTML = `Add <strong>PKR ${remaining.toLocaleString()}</strong> more to get FREE Delivery!`;
  }
}

// 4. Quick View Modal Logic
function openQuickView(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  state.selectedProductForModal = product;
  state.selectedSize = product.sizes[0] || 'Medium';
  
  const modalContent = document.getElementById('quickview-content');
  if (!modalContent) return;
  
  modalContent.innerHTML = `
    <!-- Top Back Bar -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
      <button onclick="closeQuickView()" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.88rem; color: var(--text-dark); background: var(--bg-secondary); padding: 8px 16px; border-radius: var(--radius-full); transition: var(--transition-fast); border: 1px solid var(--border-light);" onhover="this.style.background='var(--primary-gold)'">
        <i class="fa-solid fa-arrow-left"></i> ← Back to Store
      </button>
      <button class="close-modal-btn" onclick="closeQuickView()" style="position: static;"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; align-items: center;">
      <div style="text-align: center;">
        <img src="${product.image}" style="width: 100%; max-height: 250px; border-radius: var(--radius-md); object-fit: cover; box-shadow: var(--shadow-sm);" />
      </div>
      <div>
        <div style="color: var(--primary-gold); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">
          ${product.pieces}
        </div>
        <h2 style="font-size: 1.4rem; margin: 4px 0 8px; font-weight: 700;">${product.name}</h2>
        
        <div class="price-row" style="margin-bottom: 12px;">
          <span class="current-price" style="font-size: 1.3rem;">PKR ${product.finalPrice.toLocaleString()}</span>
          ${product.effectiveDiscount > 0 ? `<span class="original-price" style="font-size: 0.95rem;">PKR ${product.price.toLocaleString()}</span>` : ''}
          ${product.effectiveDiscount > 0 ? `<span class="discount-tag-small">(${product.effectiveDiscount}% OFF)</span>` : ''}
        </div>
        
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 16px; line-height: 1.5;">
          ${product.description}
        </p>
        
        <div style="margin-bottom: 16px; background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-md); font-size: 0.85rem;">
          <div><strong>Fabric Details:</strong> ${product.fabric}</div>
          <div style="margin-top: 4px;"><strong>Color:</strong> ${product.color}</div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="font-weight: 700; font-size: 0.88rem; display: block; margin-bottom: 6px;">Select Size:</label>
          <div class="size-chips-wrap">
            ${product.sizes.map(size => `
              <div class="size-chip ${size === state.selectedSize ? 'selected' : ''}" onclick="selectModalSize('${size}')">
                ${size}
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn-primary" style="flex: 1; justify-content: center; padding: 12px;" onclick="addToCart('${product.id}', state.selectedSize, 1); closeQuickView();">
            <i class="fa-solid fa-bag-shopping"></i> Add to Cart
          </button>
          <button class="btn-whatsapp-direct" style="flex: 1; justify-content: center; padding: 12px;" onclick="directWhatsAppOrderSingle('${product.id}', state.selectedSize)">
            <i class="fa-brands fa-whatsapp"></i> Order on WhatsApp
          </button>
        </div>

        <!-- Bottom Back Button -->
        <div style="margin-top: 16px; text-align: center;">
          <button onclick="closeQuickView()" style="background: none; border: none; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; cursor: pointer; text-decoration: underline;">
            ← Back to All Clothing Items
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('quickview-modal').classList.add('active');
}

function selectModalSize(size) {
  state.selectedSize = size;
  document.querySelectorAll('.size-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.innerText.trim() === size);
  });
}

function closeQuickView() {
  document.getElementById('quickview-modal').classList.remove('active');
}

// 5. WhatsApp Direct Receipt & Checkout System
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast("Your cart is empty!");
    return;
  }
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('active');
}

function processWhatsAppCheckout(e) {
  if (e) e.preventDefault();
  
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const city = document.getElementById('cust-city').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const notes = document.getElementById('cust-notes').value.trim();
  
  if (!name || !phone || !address) {
    showToast("Please fill in your Name, Phone, and Address!");
    return;
  }
  
  let subtotal = 0;
  let orderItemsText = "";
  
  state.cart.forEach((item, index) => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    orderItemsText += `${index + 1}. *${item.name}*\n   • Size: ${item.size}\n   • Price: PKR ${item.price.toLocaleString()} ${item.discountPercent > 0 ? `(Original PKR ${item.originalPrice.toLocaleString()} - ${item.discountPercent}% OFF)` : ''}\n   • Qty: ${item.qty}\n\n`;
  });
  
  const textMessage = 
`✨ *NEW ORDER REQUEST - KHAISTA LIBAAS* ✨
-------------------------------------
👤 *CUSTOMER DETAILS:*
• *Name:* ${name}
• *Phone:* ${phone}
• *City:* ${city || 'Not specified'}
• *Delivery Address:* ${address}
${notes ? `• *Special Notes:* ${notes}\n` : ''}
-------------------------------------
🛍️ *ORDER ITEMS:*
${orderItemsText}-------------------------------------
💰 *TOTAL AMOUNT:* PKR ${subtotal.toLocaleString()}
🚚 *DELIVERY:* ${subtotal >= 5000 ? 'FREE Nationwide Delivery' : 'Standard Courier Shipping'}
-------------------------------------
📲 *Social Accounts:*
Instagram: @khaistalibaas.pk
TikTok: @khaistalibaas.pk

Please confirm my order and share Bank Transfer / COD payment details.`;

  const encodedMsg = encodeURIComponent(textMessage);
  const waUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMsg}`;
  
  // Launch WhatsApp directly
  window.open(waUrl, '_blank');
  
  // Reset cart after sending
  state.cart = [];
  saveCart();
  updateCartBadge();
  closeCheckoutModal();
  showToast("Opening WhatsApp with your order receipt! Thank you for choosing Khaista Libaas.");
}

// Single Item WhatsApp Order Direct
function directWhatsAppOrderSingle(productId, customSize = null) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  const size = customSize || (product.sizes.includes('Unstitched') ? 'Unstitched' : 'Medium');
  
  const textMessage = 
`✨ *INQUIRY / DIRECT ORDER - KHAISTA LIBAAS* ✨
-------------------------------------
👗 *Product:* ${product.name}
📏 *Size:* ${size}
🧵 *Fabric:* ${product.fabric}
💰 *Price:* PKR ${product.finalPrice.toLocaleString()} ${product.effectiveDiscount > 0 ? `(Original PKR ${product.price.toLocaleString()} - ${product.effectiveDiscount}% OFF)` : ''}

Please let me know if this item is in stock and guide me on how to place my order.

Instagram: @khaistalibaas.pk`;

  const encodedMsg = encodeURIComponent(textMessage);
  const waUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMsg}`;
  
  window.open(waUrl, '_blank');
}

// 6. UI Handlers & Drawers
function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('cart-drawer').classList.add('open');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
}

function openOwnerModal() {
  document.getElementById('owner-modal').classList.add('active');
}

function closeOwnerModal() {
  document.getElementById('owner-modal').classList.remove('active');
}

function openSizeGuideModal() {
  document.getElementById('sizeguide-modal').classList.add('active');
}

function closeSizeGuideModal() {
  document.getElementById('sizeguide-modal').classList.remove('active');
}

function toggleWishlist(productId) {
  const idx = state.wishlist.indexOf(productId);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    showToast("Removed from Wishlist");
  } else {
    state.wishlist.push(productId);
    showToast("Saved to Wishlist!");
  }
  localStorage.setItem('khaista_wishlist', JSON.stringify(state.wishlist));
  renderProducts();
}

function showToast(message) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.style.cssText = `
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      background: var(--bg-dark); color: #e6ca94; border: 1px solid var(--primary-gold);
      padding: 12px 24px; border-radius: var(--radius-full); font-weight: 600;
      box-shadow: var(--shadow-lg); z-index: 999; font-size: 0.9rem;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}

// Event Listeners setup
function setupEventListeners() {
  // Search Bar
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderProducts();
    });
  }
  
  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderProducts();
    });
  }
  
  // Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.activeCategory = e.target.dataset.category;
      renderProducts();
    });
  });

  // Escape key handler to go back / close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeQuickView();
      closeCartDrawer();
      closeCheckoutModal();
      closeOwnerModal();
    }
  });

  // Start Motion Reel Reel Player
  initMotionReel();
}

// 7. Motion Video Reel Player Logic
const MOTION_REELS = [
  {
    image: "chiffon_1.jpg",
    title: "Blush Chiffon Festive Pret",
    subtitle: "FLAT 30% OFF - PKR 10,150"
  },
  {
    image: "lawn_1.jpg",
    title: "Emerald Royal Embroidered Lawn",
    subtitle: "FLAT 50% OFF - PKR 4,495"
  },
  {
    image: "velvet_1.jpg",
    title: "Imperial Navy Velvet Zari Edition",
    subtitle: "FLAT 50% OFF - PKR 8,495"
  },
  {
    image: "hero_1.jpg",
    title: "Burgundy Bridal Anarkali Gown",
    subtitle: "FLAT 15% OFF - PKR 21,240"
  }
];

let motionReelIndex = 0;
let motionInterval = null;
let isMotionPlaying = true;

function initMotionReel() {
  updateMotionReelUI();
  startMotionTimer();
}

function startMotionTimer() {
  if (motionInterval) clearInterval(motionInterval);
  motionInterval = setInterval(() => {
    if (isMotionPlaying) {
      nextMotionReel();
    }
  }, 3500);
}

function updateMotionReelUI() {
  const reelImg = document.getElementById('motion-reel-img');
  const titleEl = document.getElementById('motion-reel-title');
  const subEl = document.getElementById('motion-reel-sub');
  
  if (!reelImg || !titleEl) return;
  
  reelImg.style.opacity = '0.3';
  setTimeout(() => {
    const data = MOTION_REELS[motionReelIndex];
    reelImg.src = data.image;
    titleEl.innerText = data.title;
    subEl.innerText = data.subtitle;
    reelImg.style.opacity = '1';
  }, 300);
}

function nextMotionReel() {
  motionReelIndex = (motionReelIndex + 1) % MOTION_REELS.length;
  updateMotionReelUI();
}

function prevMotionReel() {
  motionReelIndex = (motionReelIndex - 1 + MOTION_REELS.length) % MOTION_REELS.length;
  updateMotionReelUI();
}

function toggleMotionPlay() {
  isMotionPlaying = !isMotionPlaying;
  const btn = document.getElementById('motion-play-btn');
  if (btn) {
    btn.innerHTML = isMotionPlaying ? `<i class="fa-solid fa-pause"></i>` : `<i class="fa-solid fa-play"></i>`;
  }
}

