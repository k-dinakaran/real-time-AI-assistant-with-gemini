from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI(title="FastAPI CRUD Example")

# Root endpoint (homepage)
@app.get("/")
async def root():
    return {"message": "Welcome to FastAPI CRUD API! Go to /docs to test the API."}

# Sample in-memory storage
items = []

class Item(BaseModel):
    id: int
    name: str
    description: str = None


@app.get("/items", response_model=List[Item])
async def get_items():
    return items


@app.post("/items", response_model=Item)
async def add_item(item: Item):
    for i in items:
        if i.id == item.id:
            raise HTTPException(status_code=400, detail="Item with this ID already exists")
    items.append(item)
    return item


@app.put("/items/{item_id}", response_model=Item)
async def update_item(item_id: int, updated_item: Item):
    for index, i in enumerate(items):
        if i.id == item_id:
            items[index] = updated_item
            return updated_item
    raise HTTPException(status_code=404, detail="Item not found")


@app.delete("/items/{item_id}")
async def delete_item(item_id: int):
    for i in items:
        if i.id == item_id:
            items.remove(i)
            return {"message": "Item deleted"}
    raise HTTPException(status_code=404, detail="Item not found")