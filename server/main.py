from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import os
import sys
from pathlib import Path

# Ensure server and root directory are in sys.path
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
for p in [str(current_dir), str(project_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from email_service import send_welcome_email
from server.routes.plan import router as plan_router

load_dotenv()

app = FastAPI(title="PLANORA Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(plan_router)


@app.get("/")
def root():
    return {
        "message": "PLANORA backend is running"
    }


class WelcomeEmail(BaseModel):
    email: str
    name: str


@app.post("/emails/welcome")
async def welcome_email(data: WelcomeEmail):

    success, message = send_welcome_email(
        data.email,
        data.name
    )

    return {
        "success": success,
        "message": message
    }