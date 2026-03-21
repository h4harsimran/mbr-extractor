"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with defaults and .env loading."""

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # PDF rendering
    render_dpi: int = 300

    # Retry
    max_retries: int = 3
    retry_base_delay: float = 2.0

    # Paths
    data_dir: str = "data"
    db_path: str = "data/mbr_extractor.db"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # ── derived paths ──────────────────────────────────────────────

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def data_root(self) -> Path:
        return self.project_root / self.data_dir

    @property
    def uploads_dir(self) -> Path:
        return self.data_root / "uploads"

    @property
    def images_dir(self) -> Path:
        return self.data_root / "images"

    @property
    def raw_json_dir(self) -> Path:
        return self.data_root / "raw_json"

    @property
    def normalized_json_dir(self) -> Path:
        return self.data_root / "normalized_json"

    @property
    def exports_dir(self) -> Path:
        return self.data_root / "exports"

    @property
    def database_path(self) -> Path:
        return self.project_root / self.db_path


settings = Settings()
