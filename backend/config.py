from pydantic import PostgresDsn, computed_field
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgrespassword"
    POSTGRES_DB: str = "synq_auth_db"
    POSTGRES_PORT: int = 5432
    N8N_WEBHOOK_URL: str = "https://aditya546shah.app.n8n.cloud/webhook/user-onboarding"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    OPENAI_API_KEY: str = ""
    SERVICE_NAME: str = "Synq.to"
    DB_POOL_SIZE: int = 5
    MASTER_VAULT_KEY: str = "synq-development-secret-vault-key-change-me"
    JWT_SECRET_KEY: str = "synq-jwt-super-secret-key-change-me"
    MYSQL_DOCKER_HOST: str = ""
    POSTGRES_DOCKER_HOST: str = ""
    ENVIRONMENT: str = "development"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    RESET_TOKEN_EXPIRE_MINUTES: int = 15

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        return MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

settings = Settings()
