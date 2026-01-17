const API_URL = "http://127.0.0.1:8000"; // backend base URL

// ----------------------------
// Helper: Fetch token from localStorage
// ----------------------------
function getToken() {
    return localStorage.getItem("token") || "";
}

// ----------------------------
// API Functions
// ----------------------------
window.api = {
    login: async (username, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });
        if (!res.ok) throw new Error("Login failed");
        return res.json();
    },

    fetchMenu: async () => {
        const res = await fetch(`${API_URL}/menu/`, {
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to load menu");
        return res.json();
    },

    addMenuItem: async (item) => {
        const res = await fetch(`${API_URL}/menu/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify(item)
        });
        if (!res.ok) throw new Error("Failed to add menu item");
        return res.json();
    },

    updateMenuItem: async (id, item) => {
        const res = await fetch(`${API_URL}/menu/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify(item)
        });
        if (!res.ok) throw new Error("Failed to update menu item");
        return res.json();
    },

    deleteMenuItem: async (id) => {
        const res = await fetch(`${API_URL}/menu/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error("Failed to delete menu item");
        return res.json();
    },

    submitOrder: async (items) => {
        const res = await fetch(`${API_URL}/orders/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({ items })
        });
        if (!res.ok) throw new Error("Failed to submit order");
        return res.json();
    }
};

// ----------------------------
// Dashboard Logic
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if (page === "login") {
        initLoginPage();
    }

    if (page === "dashboard") {
        initDashboard();
    }
});

// ----------------------------
// Login Page
// ----------------------------
function initLoginPage() {
    const loginForm = document.getElementById("loginForm");
    loginForm?.addEventListener("submit", async e => {
        e.preventDefault();
        try {
            const username = document.getElementById("username").value;
            const password = document.getElementById("password").value;
            const data = await window.api.login(username, password);
            localStorage.setItem("token", data.access_token);
            window.location.href = "dashboard.html";
        } catch (err) {
            document.getElementById("message").innerText = err.message;
        }
    });
}

// ----------------------------
// Dashboard Page
// ----------------------------
function initDashboard() {
    let menuItems = [];
    let orderItems = [];
    let currentRole = "customer";

    const adminSection = document.getElementById("adminSection");
    const customerSection = document.getElementById("customerSection");

    // Role toggle
    document.getElementById("roleSelect").addEventListener("change", e => {
        currentRole = e.target.value;
        adminSection.classList.toggle("hidden", currentRole !== "admin");
    });

    // ----------------------------
    // Menu Loading & Rendering
    // ----------------------------
    async function loadMenu() {
        try {
            menuItems = await window.api.fetchMenu();
            renderAdminMenu();
            renderCustomerMenu();
        } catch (err) {
            alert(err.message);
        }
    }

    function renderAdminMenu() {
        const list = document.getElementById("adminMenuList");
        list.innerHTML = menuItems.map(item => `
            <li>
                <b>${item.name}</b> - $${item.price} (${item.category}) 
                [${item.is_available ? "Available" : "Unavailable"}]
                <button onclick="deleteItem(${item.id})">Delete</button>
            </li>
        `).join("");

        const select = document.getElementById("updateSelect");
        select.innerHTML = `<option value="">Select item</option>` +
            menuItems.map(i => `<option value="${i.id}">${i.name}</option>`).join("");
    }

    function renderCustomerMenu() {
        const list = document.getElementById("customerMenuList");
        list.innerHTML = menuItems.filter(i => i.is_available).map(item => `
            <li>
                <b>${item.name}</b> - $${item.price} (${item.category})
                <input type="number" min="0" value="0" id="qty_${item.id}">
                <button onclick="addToOrder(${item.id})">Add</button>
            </li>
        `).join("");
    }

    // ----------------------------
    // Order Handling
    // ----------------------------
    window.addToOrder = function(itemId) {
        const qty = parseInt(document.getElementById(`qty_${itemId}`).value);
        if (qty <= 0) return;

        const item = menuItems.find(i => i.id === itemId);
        const existing = orderItems.find(i => i.menu_item_id === itemId);
        if (existing) existing.quantity += qty;
        else orderItems.push({ menu_item_id: itemId, quantity: qty, unit_price: item.price });

        renderOrderSummary();
    };

    function renderOrderSummary() {
        const summary = document.getElementById("orderSummary");
        summary.innerHTML = orderItems.map(i => {
            const item = menuItems.find(m => m.id === i.menu_item_id);
            return `<li>${item.name} x ${i.quantity} = $${(i.quantity*i.unit_price).toFixed(2)}</li>`;
        }).join("");
    }

    document.getElementById("submitOrder").addEventListener("click", async () => {
        if (!orderItems.length) return alert("Add items first!");
        try {
            await window.api.submitOrder(orderItems);
            alert("Order submitted!");
            orderItems = [];
            renderOrderSummary();
        } catch (err) {
            alert(err.message);
        }
    });

    // ----------------------------
    // Admin CRUD
    // ----------------------------
    document.getElementById("addForm").addEventListener("submit", async e => {
        e.preventDefault();
        const newItem = {
            name: document.getElementById("addName").value,
            price: parseFloat(document.getElementById("addPrice").value),
            category: document.getElementById("addCategory").value,
            is_available: document.getElementById("addAvailable").checked
        };
        try {
            await window.api.addMenuItem(newItem);
            await loadMenu();
            e.target.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    document.getElementById("updateForm").addEventListener("submit", async e => {
        e.preventDefault();
        const id = document.getElementById("updateSelect").value;
        if (!id) return alert("Select item first!");

        const updatedItem = {};
        const name = document.getElementById("updateName").value;
        const price = document.getElementById("updatePrice").value;
        const category = document.getElementById("updateCategory").value;
        const is_available = document.getElementById("updateAvailable").checked;

        if (name) updatedItem.name = name;
        if (price) updatedItem.price = parseFloat(price);
        if (category) updatedItem.category = category;
        updatedItem.is_available = is_available;

        try {
            await window.api.updateMenuItem(id, updatedItem);
            await loadMenu();
            e.target.reset();
        } catch (err) {
            alert(err.message);
        }
    });

    window.deleteItem = async function(id) {
        try {
            await window.api.deleteMenuItem(id);
            await loadMenu();
        } catch (err) {
            alert(err.message);
        }
    };

    // Initial load
    loadMenu();
}
document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    const adminToken = localStorage.getItem("token") || "";

    if (page === "admin") {
        let menuItems = [];

        async function loadAdminMenu() {
            try {
                const res = await fetch(`${API_URL}/menu/`, {
                    headers: { "Authorization": `Bearer ${adminToken}` }
                });
                if (!res.ok) throw new Error("Failed to load menu");
                menuItems = await res.json();

                // Render menu list
                document.getElementById("adminMenuList").innerHTML = menuItems.map(item => `
                    <li>
                        <b>${item.name}</b> - $${item.price} (${item.category}) 
                        [${item.is_available ? "Available" : "Unavailable"}]
                        <button onclick="deleteMenuItem(${item.id})">Delete</button>
                    </li>
                `).join("");

                // Populate update select dropdown
                document.getElementById("updateSelect").innerHTML = `<option value="">Select item to update</option>` +
                    menuItems.map(i => `<option value="${i.id}">${i.name}</option>`).join("");

            } catch (err) {
                console.error(err);
            }
        }

        // Add Menu Item
        document.getElementById("addForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const newItem = {
                name: document.getElementById("addName").value,
                price: parseFloat(document.getElementById("addPrice").value),
                category: document.getElementById("addCategory").value,
                is_available: document.getElementById("addAvailable").checked
            };
            try {
                await window.api.addMenuItem(newItem);
                loadAdminMenu();
                e.target.reset();
            } catch (err) {
                alert(err.message);
            }
        });

        // Update Menu Item
        document.getElementById("updateForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("updateSelect").value;
            if (!id) return alert("Select an item first!");

            const updatedItem = {};
            const name = document.getElementById("updateName").value;
            const price = document.getElementById("updatePrice").value;
            const category = document.getElementById("updateCategory").value;
            const is_available = document.getElementById("updateAvailable").checked;

            if (name) updatedItem.name = name;
            if (price) updatedItem.price = parseFloat(price);
            if (category) updatedItem.category = category;
            updatedItem.is_available = is_available;

            try {
                await window.api.updateMenuItem(id, updatedItem);
                loadAdminMenu();
                e.target.reset();
            } catch (err) {
                alert(err.message);
            }
        });

        // Delete Menu Item (make global so button onclick can call)
        window.deleteMenuItem = async (id) => {
            if (!confirm("Delete this item?")) return;
            try {
                await window.api.deleteMenuItem(id);
                loadAdminMenu();
            } catch (err) {
                alert(err.message);
            }
        };

        loadAdminMenu();
    }
});
