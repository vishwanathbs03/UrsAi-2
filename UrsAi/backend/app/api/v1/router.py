"""Aggregate router for API v1."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    advisor,
    ai,
    auth,
    business,
    chat,
    copilot,
    dna,
    finance,
    health,
    intelligence,
    knowledge,
    ocr,
    recommendations,
    roadmap,
    rules,
    scenario,
    scoring,
    twin,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(business.router)
api_router.include_router(intelligence.router)
api_router.include_router(scoring.router)
api_router.include_router(dna.router)
api_router.include_router(rules.router)
api_router.include_router(knowledge.router)
api_router.include_router(ai.router)
api_router.include_router(recommendations.router)
api_router.include_router(roadmap.router)
api_router.include_router(scenario.router)
api_router.include_router(twin.router)
api_router.include_router(ocr.router)
api_router.include_router(finance.router)
api_router.include_router(copilot.router)
api_router.include_router(chat.router)
api_router.include_router(advisor.router)
