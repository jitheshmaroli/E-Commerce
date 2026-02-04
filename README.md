# 🛒 E-Commerce Web Application

A full-stack e-commerce web application built using **Node.js, Express, MongoDB, EJS, HTML, CSS, and JavaScript**. The app provides a complete online shopping experience with user authentication, product management, cart, checkout, and admin features.

---

## 🚀 Features

### 👤 User Features

* User registration and login (authentication & authorization)
* Browse products with categories and filters
* Product search functionality
* Add/remove products to cart
* Wishlist functionality
* Checkout and order placement
* Order history and tracking
* Wallet and transaction history
* Profile management

### 🛠️ Admin Features

* Admin dashboard
* Product management (CRUD)
* Category management
* Order management
* User management
* Offers and coupons management
* Sales reports and analytics

### 💳 Payment & Orders

* Secure checkout process
* Multiple payment options (razorpay, wallet, cod)
* Order status updates

---

## 🏗️ Tech Stack

### Frontend

* HTML, CSS, JavaScript
* EJS (Embedded JavaScript Templates)
* Bootstrap / Custom CSS

### Backend

* Node.js
* Express.js
* MongoDB & Mongoose

### Tools & Libraries

* PM2 (process management)
* Nginx (deployment)
* bcrypt (password hashing)
* Multer (file uploads)

---

## 📂 Project Structure

```
📦 ecommerce-app
├── 📁 controllers
├── 📁 models
├── 📁 routes
├── 📁 views
├── 📁 public
├── 📁 middlewares
├── 📁 config
├── 📁 utils
├── .env
├── package.json
└── server.js
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
https://github.com/jitheshmaroli/E-Commerce.git
cd E-Commerce
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=4000
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
```

### 4️⃣ Run the application

```bash
npm start
```

The app will run on:

```
http://localhost:4000
```

---

## 🌐 Deployment

The application can be deployed using:

* AWS EC2
* Nginx
* PM2
* MongoDB Atlas

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repo and submit a pull request.

---

## 👨‍💻 Author

**Jithesh M**

---

⭐ If you like this project, give it a star!
