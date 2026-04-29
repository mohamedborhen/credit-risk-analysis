"""
SQLAlchemy database engine, session factory, and declarative base.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from core.config import settings


# Ensure psycopg v3 dialect is used if URL starts with postgresql://
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine_kwargs = {
    "pool_pre_ping": True,
}
if _db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({"pool_size": 10, "max_overflow": 20})

engine = create_engine(
    _db_url,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
