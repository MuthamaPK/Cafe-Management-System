/* =========================
   CONFIG
========================= */
const API_URL = "http://127.0.0.1:8000";

/* =========================
   HELPERS
========================= */
function isLoggedIn() {
    return !!localStorage.getItem("token");
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "index.html";
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    };
}

/* =========================
   CENTRAL API HANDLER
========================= */
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(options.auth !== false ? authHeaders() : {})
        }
    });

    if (res.status === 401) {
        logout();
        throw new Error("Session expired");
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Request failed");
    }

    return res.json();
}

/* =========================
   LOGIN (index.html)
========================= */
async function login(e) {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("loginMessage");

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });

        if (!res.ok) throw new Error("Invalid credentials");

        const data = await res.json();
        localStorage.setItem("token", data.access_token);

        window.location.href = "dashboard.html";
    } catch (err) {
        msg.textContent = err.message;
    }
}

/* =========================
   PAGE PROTECTION
========================= */
function protectPage() {
    if (!isLoggedIn()) {
        window.location.href = "index.html";
    }
}

/* =========================
   DASHBOARD / MENU
========================= */
let menuItems = [];
let order = [];

async function loadMenu() {
    menuItems = await apiFetch(`${API_URL}/menu/`);

    const menuDiv = document.getElementById("menuList");
    menuDiv.innerHTML = menuItems
        .filter(i => i.is_available)
        .map(item => `
            <div class="menu-item">
                <span>${item.name} - $${item.price}</span>
                <button onclick="addToOrder(${item.id})">Add</button>
            </div>
        `).join("");
}

function addToOrder(id) {
    const item = menuItems.find(i => i.id === id);
    const existing = order.find(i => i.menu_item_id === id);

    if (existing) {
        existing.quantity += 1;
    } else {
        order.push({
            menu_item_id: id,
            name: item.name,
            unit_price: item.price,
            quantity: 1
        });
    }

    renderOrder();
}

function renderOrder() {
    const orderDiv = document.getElementById("orderList");
    const totalDiv = document.getElementById("orderTotal");

    let total = 0;

    orderDiv.innerHTML = order.map(item => {
        total += item.unit_price * item.quantity;
        return `
            <div class="order-item">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${item.unit_price * item.quantity}</span>
            </div>
        `;
    }).join("");

    totalDiv.textContent = `Total: $${total}`;
}

async function submitOrder() {
    if (order.length === 0) return alert("Order is empty");

    await apiFetch(`${API_URL}/orders/`, {
        method: "POST",
        body: JSON.stringify({
            items: order.map(i => ({
                menu_item_id: i.menu_item_id,
                quantity: i.quantity
            }))
        })
    });

    order = [];
    renderOrder();
    alert("Order placed successfully!");
}

/* =========================
   ORDER HISTORY
========================= */
async function loadOrders() {
    const orders = await apiFetch(`${API_URL}/orders/`);
    const container = document.getElementById("ordersList");

    container.innerHTML = orders.map(o => `
        <div class="card">
            <h3>Order #${o.id}</h3>
            <p>${new Date(o.created_at).toLocaleString()}</p>
            <ul>
                ${o.items.map(i => `
                    <li>${i.quantity} × ${i.menu_item_id} @ $${i.unit_price}</li>
                `).join("")}
            </ul>
            <strong>Total: $${o.total_amount}</strong>
        </div>
    `).join("");
}

/* =========================
   ADMIN
========================= */
async function loadAdminMenu() {
    const items = await apiFetch(`${API_URL}/menu/`);
    const list = document.getElementById("adminMenuList");
    const select = document.getElementById("updateSelect");

    list.innerHTML = items.map(i => `
        <li>
            <b>${i.name}</b> - $${i.price}
            <button class="danger" onclick="deleteItem(${i.id})">Delete</button>
        </li>
    `).join("");

    select.innerHTML =
        `<option value="">Select item</option>` +
        items.map(i => `<option value="${i.id}">${i.name}</option>`).join("");
}

async function addItem(e) {
    e.preventDefault();

    await apiFetch(`${API_URL}/menu/`, {
        method: "POST",
        body: JSON.stringify({
            name: addName.value,
            price: parseFloat(addPrice.value),
            category: addCategory.value,
            is_available: addAvailable.checked
        })
    });

    e.target.reset();
    loadAdminMenu();
}

async function deleteItem(id) {
    await apiFetch(`${API_URL}/menu/${id}`, { method: "DELETE" });
    loadAdminMenu();
}

async function updateItem(e) {
    e.preventDefault();
    const id = updateSelect.value;
    if (!id) return alert("Select an item");

    await apiFetch(`${API_URL}/menu/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            name: updateName.value || undefined,
            price: updatePrice.value ? parseFloat(updatePrice.value) : undefined,
            category: updateCategory.value || undefined,
            is_available: updateAvailable.checked
        })
    });

    e.target.reset();
    loadAdminMenu();
}

/* =========================
   AUTO INIT PER PAGE
========================= */
document.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById("loginForm")) {
        document.getElementById("loginForm").addEventListener("submit", login);
    }

    if (document.getElementById("menuList")) {
        protectPage();
        loadMenu();
    }

    if (document.getElementById("ordersList")) {
        protectPage();
        loadOrders();
    }

    if (document.getElementById("adminMenuList")) {
        protectPage();
        loadAdminMenu();
        addForm.addEventListener("submit", addItem);
        updateForm.addEventListener("submit", updateItem);
    }
});
