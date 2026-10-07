"""
PLANORA Floor-Plan Generation Route
Phase 7 implementation: FastAPI route handling POST /generate-plan
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from server.services.model_service import get_model_service


router = APIRouter(tags=["Floor Plan Generation"])


class PlanGenerationRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="Natural language spatial requirements (e.g. '30x40 ft house with 2 bedrooms, 2 bathrooms, kitchen and parking')",
        example="30x40 ft house with 2 bedrooms, 2 bathrooms, 1 kitchen, 1 living room, 1 dining room and parking"
    )


class PlanGenerationResponse(BaseModel):
    success: bool
    prompt: str
    requirements: Dict[str, Any]
    layout: Dict[str, Any]
    validation: Dict[str, Any]
    svg: str
    was_repaired: Optional[bool] = False


@router.post("/generate-plan", response_model=PlanGenerationResponse)
async def generate_plan_endpoint(request: PlanGenerationRequest):
    """
    Receives natural language requirements, runs T5 model inference,
    parses tokens to structured layout, validates constraints, repairs if needed,
    and returns verified JSON layout with rendered 2D vector SVG.
    """
    try:
        service = get_model_service()
        result = service.generate(request.prompt)

        return PlanGenerationResponse(
            success=result["success"],
            prompt=result["prompt"],
            requirements=result["requirements"],
            layout=result["layout"],
            validation=result["validation"],
            svg=result["svg"],
            was_repaired=result.get("was_repaired", False)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Floor-plan generation error: {str(exc)}"
        )
