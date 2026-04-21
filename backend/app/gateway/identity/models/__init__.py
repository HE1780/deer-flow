"""ORM models for identity schema."""

from app.gateway.identity.models.base import Base, TenantScoped, WorkspaceScoped

__all__ = ["Base", "TenantScoped", "WorkspaceScoped"]
