# adapters/base.py
from abc import ABC, abstractmethod

class SourceAdapter(ABC):
    source_type: SourceType
    
    @abstractmethod
    async def fetch(self, since: datetime) -> list[UnifiedLead]:
        """Pull new items since last cursor."""
    
    @abstractmethod
    async def healthcheck(self) -> bool:
        ...


# adapters/craigslist.py
import httpx
from bs4 import BeautifulSoup

class CraigslistAdapter(SourceAdapter):
    source_type = SourceType.CRAIGSLIST
    
    def __init__(self, city: str, sections: list[str]):
        # sections like ["sss"] (services), ["gigs"], etc.
        self.city = city
        self.sections = sections
    
    async def fetch(self, since):
        leads = []
        async with httpx.AsyncClient(timeout=20) as client:
            for section in self.sections:
                url = f"https://{self.city}.craigslist.org/search/{section}"
                r = await client.get(url, params={"format": "rss"})
                soup = BeautifulSoup(r.text, "xml")
                for item in soup.find_all("item"):
                    leads.append(UnifiedLead(
                        source=self.source_type,
                        source_url=item.link.text,
                        title=item.title.text,
                        body=item.description.text or "",
                        posted_at=datetime.fromisoformat(item.pubDate.text),
                    ))
        return leads


# adapters/facebook.py — uses official Graph API for Groups you admin/moderate
# (respecting ToS; scraping personal groups is against Meta policy)
class FacebookGroupAdapter(SourceAdapter):
    source_type = SourceType.FACEBOOK
    
    def __init__(self, group_ids: list[str], access_token: str):
        self.group_ids = group_ids
        self.token = access_token
    
    async def fetch(self, since):
        leads = []
        async with httpx.AsyncClient() as client:
            for gid in self.group_ids:
                r = await client.get(
                    f"https://graph.facebook.com/v19.0/{gid}/feed",
                    params={
                        "access_token": self.token,
                        "since": int(since.timestamp()),
                        "fields": "id,message,permalink_url,created_time,from",
                    },
                )
                for post in r.json().get("data", []):
                    leads.append(UnifiedLead(
                        source=self.source_type,
                        source_url=post["permalink_url"],
                        source_group=gid,
                        body=post.get("message", ""),
                        author_handle=post.get("from", {}).get("name"),
                        posted_at=datetime.fromisoformat(post["created_time"]),
                    ))
        return leads


# adapters/linkedin.py — use official LinkedIn API or a licensed data provider
# (e.g., Proxycurl, PhantomBuster) rather than direct scraping
class LinkedInAdapter(SourceAdapter):
    source_type = SourceType.LINKEDIN
    
    def __init__(self, api_key: str, keywords: list[str], geo: str):
        self.api_key = api_key
        self.keywords = keywords
        self.geo = geo
    
    async def fetch(self, since):
        # Pseudo — depends on your provider
        ...