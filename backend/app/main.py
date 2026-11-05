import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.api.routes import auth, records, analytics
from app.core.config import get_settings
from app.core.database import engine

app = FastAPI(
    title="Folio Mini CRM",
    version="1.0.0",
    description="A private workspace for your clients, pipeline, and next steps.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
for router in [auth.router, records.router, analytics.router]:
    app.include_router(router, prefix="/api")


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={
            "detail": "This change conflicts with an existing record. Refresh and try again."
        },
    )


@app.exception_handler(ValidationError)
async def validation_error(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422, content={"detail": "The submitted values are invalid."}
    )


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logging.exception("Unhandled request error")
    return JSONResponse(
        status_code=500, content={"detail": "Something went wrong. Please try again."}
    )


@app.get("/api/health", tags=["System"])
async def health():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ok"}
