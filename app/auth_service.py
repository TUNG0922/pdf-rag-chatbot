"""
JWT token helpers and FastAPI auth dependencies.
"""

from datetime import datetime, timezone, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app import config
from app import user_service

# tokenUrl is where the interactive docs send credentials to obtain a token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=config.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(
        payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM]
    )


_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Resolve the current user from the Bearer token.

    Returns a dict: {"username", "role"}.
    """
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise _credentials_exc

    username = payload.get("sub")
    role = payload.get("role")
    if not username or not role:
        raise _credentials_exc

    # Make sure the user still exists.
    user = user_service.get_user_by_username(username)
    if user is None:
        raise _credentials_exc

    return {"username": user["username"], "role": user["role"]}


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that only allows admin users through."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


def require_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency for the chat function, which belongs to regular users only.
    Admins manage PDFs and do not have the chat function.
    """
    if current_user.get("role") == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins do not have the chat function; chat is for users.",
        )
    return current_user
