from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from email_service import send_welcome_email

load_dotenv()

app = FastAPI(title="PLANORA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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