# filters.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LeadFilter(BaseModel):
    services: Optional[list[str]] = None          # any-of match
    sources: Optional[list[SourceType]] = None
    locations: Optional[list[str]] = None
    min_heat: float = 0
    min_urgency: int = 0
    budget_min: Optional[float] = None
    posted_after: Optional[datetime] = None
    keywords: Optional[list[str]] = None          # full-text
    radius_km: Optional[float] = None
    center_geo: Optional[tuple[float, float]] = None

    def to_sql(self) -> tuple[str, dict]:
        clauses, params = ["1=1"], {}
        if self.services:
            clauses.append("services && :services")
            params["services"] = self.services
        if self.sources:
            clauses.append("source = ANY(:sources)")
            params["sources"] = [s.value for s in self.sources]
        if self.locations:
            clauses.append("location ILIKE ANY(:locations)")
            params["locations"] = [f"%{l}%" for l in self.locations]
        clauses.append("heat_score >= :min_heat")
        params["min_heat"] = self.min_heat
        clauses.append("urgency >= :min_urgency")
        params["min_urgency"] = self.min_urgency
        if self.budget_min is not None:
            clauses.append("(budget_max IS NULL OR budget_max >= :budget_min)")
            params["budget_min"] = self.budget_min
        if self.posted_after:
            clauses.append("posted_at >= :posted_after")
            params["posted_after"] = self.posted_after
        if self.keywords:
            clauses.append("body ILIKE ALL(:kws)")
            params["kws"] = [f"%{k}%" for k in self.keywords]
        if self.radius_km and self.center_geo:
            clauses.append("""
                geo IS NOT NULL AND
                earth_distance(ll_to_earth(:lat, :lng),
                               ll_to_earth(geo[1], geo[2])) <= :radius_m
            """)
            params.update(lat=self.center_geo[0], lng=self.center_geo[1],
                          radius_m=self.radius_km * 1000)
        return " AND ".join(clauses), params