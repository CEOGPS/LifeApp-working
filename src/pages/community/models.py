# models.py
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl
import uuid

class SourceType(str, Enum):
    FACEBOOK = "facebook"
    NEXTDOOR = "nextdoor"
    CRAIGSLIST = "craigslist"
    LINKEDIN = "linkedin"
    REDDIT = "reddit"
    LOCAL_SITE = "local_site"

class IntentType(str, Enum):
    SEEKING_SERVICE = "seeking_service"
    OFFERING_SERVICE = "offering_service"
    RECOMMENDATION_REQUEST = "recommendation_request"
    GENERAL_DISCUSSION = "general_discussion"
    SPAM = "spam"

class UnifiedLead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: SourceType
    source_url: HttpUrl
    source_group: Optional[str] = None
    
    # Content
    title: Optional[str] = None
    body: str
    author_handle: Optional[str] = None
    
    # AI-extracted
    intent: IntentType = IntentType.GENERAL_DISCUSSION
    services: list[str] = []                    # ["plumber", "roof repair"]
    location: Optional[str] = None              # "Austin, TX"
    geo: Optional[tuple[float, float]] = None   # (lat, lng)
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    urgency: int = Field(0, ge=0, le=10)        # 0=whenever, 10=ASAP
    contact_hint: Optional[str] = None          # email/phone if present
    
    # Scoring
    heat_score: float = Field(0, ge=0, le=100)
    embedding: Optional[list[float]] = None
    
    # Metadata
    posted_at: datetime
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    dedup_hash: Optional[str] = None
    raw_payload: Optional[dict] = None