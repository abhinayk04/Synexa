import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt

from app.config import settings
from app.services.database import get_users_collection

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pwd_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=getattr(settings, "JWT_EXPIRE_MINUTES", 1440)
    )
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(
        payload,
        getattr(settings, "JWT_SECRET", "change-me"),
        algorithm=getattr(settings, "JWT_ALGORITHM", "HS256"),
    )


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            getattr(settings, "JWT_SECRET", "change-me"),
            algorithms=[getattr(settings, "JWT_ALGORITHM", "HS256")],
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return user_id
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalid or expired: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    if not credentials or not credentials.credentials:
        return "default_user"
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return "default_user"


async def signup_user(email: str, password: str) -> dict:
    import uuid

    try:
        col = get_users_collection()
    except Exception as e:
        logger.error(f"[Auth] Database connection failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database unavailable. Please check MongoDB connection.",
        )

    try:
        existing = await col.find_one({"email": email.lower()})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered. Please sign in instead.",
            )

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        hashed_pwd = hash_password(password)

        await col.insert_one({
            "_id": user_id,
            "email": email.lower(),
            "hashed_password": hashed_pwd,
            "created_at": now,
        })

        token = create_access_token(user_id)
        logger.info(f"[Auth] New user signed up: {email}")
        return {
            "user_id": user_id,
            "email": email.lower(),
            "access_token": token,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Signup failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Signup failed: {str(e)}",
        )


async def login_user(email: str, password: str) -> dict:
    try:
        col = get_users_collection()
        user = await col.find_one({"email": email.lower()})

        if not user or not verify_password(password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        token = create_access_token(user["_id"])
        logger.info(f"[Auth] Login success: {email}")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user["_id"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Login error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {str(e)}",
        )