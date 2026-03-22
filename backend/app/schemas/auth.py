from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MobileExchangeRequest(BaseModel):
    one_time_code: str = Field(min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=16)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=16)


class SessionUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    login: str
    display_name: str


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_token_expires_at: datetime
    user: SessionUser


class FortyTwoTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 7200
    refresh_token: str | None = None
    scope: str | None = None


class FortyTwoProfile(BaseModel):
    id: int
    login: str
    display_name: str
