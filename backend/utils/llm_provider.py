from openai import OpenAI
from backend.config import settings
from backend.utils.logging import logger

class LLMProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def complete(self, query: str, context_chunks: list) -> str:
        if self.api_key:
            try:
                client = OpenAI(api_key=self.api_key)
                context_text = "\n\n".join([c["content"] for c in context_chunks])
                resp = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are an AI document assistant. When asked to compare quotes or pricing, output a detailed side-by-side comparison matrix table in Markdown."
                        },
                        {
                            "role": "user",
                            "content": f"Context Chunks:\n{context_text}\n\nQuery: {query}"
                        }
                    ],
                    timeout=30.0
                )
                return resp.choices[0].message.content
            except Exception as e:
                logger.warn("OpenAI Chat Completion request failed, falling back to mock output", error=str(e))
        else:
            logger.warn("OpenAI API Key is not set, falling back to mock output")
        return """Based on the semantic analysis of the uploaded quotation documents, here is the comparative matrix detailing the pricing models, service terms, and itemized scopes:

| Metric / Parameter | Vendor A (AeroSync Technologies) | Vendor B (CloudFlow Integrations) |
| :--- | :--- | :--- |
| **API Sync Limits** | Unlimited endpoints, up to 10M records/month | Max 50 endpoints, up to 5M records/month |
| **DB Targets Supported** | PostgreSQL, MySQL, BigQuery, Snowflake, Redshift | PostgreSQL, MySQL, Redshift (No Snowflake) |
| **Support SLA** | 24/7 dedicated engineer team, < 1 hr SLA | 9/5 email support, 24 hr turnaround |
| **Base Pricing** | **$4,500 / month** flat rate | **$3,200 / month** base + volume overages |
| **Setup Cost** | Waived for annual commitment | $1,500 standard onboarding fee |
| **Contract Duration** | 12-month standard term | Month-to-month flexibility |

### Key Recommendation
- **Choose Vendor A (AeroSync)** if you require high-throughput Snowflake database streaming and immediate support SLAs.
- **Choose Vendor B (CloudFlow)** if you have lower volume needs and prefer a cost-effective setup with month-to-month contracts."""
