from fastapi import APIRouter

router = APIRouter()


@router.get("/42/start")
def start_oauth() -> dict[str, str]:
    return {"message": "TODO: Implement 42 OAuth start endpoint."}


@router.get("/42/callback")
def oauth_callback() -> dict[str, str]:
    return {"message": "TODO: Implement 42 OAuth callback handler."}


@router.post("/mobile/exchange")
def mobile_exchange() -> dict[str, str]:
    return {"message": "TODO: Exchange one-time code for app tokens."}


@router.post("/refresh")
def refresh_session() -> dict[str, str]:
    return {"message": "TODO: Implement app token refresh."}


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "TODO: Revoke refresh token and logout."}
