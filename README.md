# FastAPI CRUD with Docker

This is a simple CRUD REST API built with **FastAPI**.  
It supports basic **GET, POST, PUT, DELETE** operations using **in-memory storage**.

---

## 🚀 Features
- Asynchronous FastAPI endpoints
- In-memory data storage (no database needed)
- CRUD operations:
  - `GET /items` – Retrieve items
  - `POST /items` – Add a new item
  - `PUT /items/{id}` – Update item by ID
  - `DELETE /items/{id}` – Delete item by ID
- Interactive API docs available at `/docs`

---

## ⚙️ Setup Instructions

### 1️⃣ Run Locally (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
uvicorn main:app --reload

API will be available at: http://127.0.0.1:8000
Docs at: http://127.0.0.1:8000/docs

### run locally with (docker)

# Build Docker image
docker build -t fastapi-crud-app .

# Run container
docker run -d -p 8000:8000 fastapi-crud-app

📌 Example API Calls

➤ Get all items

curl -X GET http://127.0.0.1:8000/items


➤ Add an item

curl -X POST http://127.0.0.1:8000/items \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "name": "Laptop", "description": "Gaming laptop"}'


➤ Update an item

curl -X PUT http://127.0.0.1:8000/items/1 \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "name": "Laptop Pro", "description": "Updated gaming laptop"}'


➤ Delete an item

curl -X DELETE http://127.0.0.1:8000/items/1