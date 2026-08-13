from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import User
from app.schemas import AuthResponse, LoginRequest, SignupRequest, UserPublic
from app.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

CAMPUS_DOMAINS = (".edu", ".ac.in", ".edu.in")


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, session: Session = Depends(get_session)) -> AuthResponse:
    email = payload.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    user = User(
        email=email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        campus=payload.campus,
        hostel_block=payload.hostel_block,
        grad_year=payload.grad_year,
        avatar_seed=payload.name.strip().lower().replace(" ", "-") or "student",
        is_email_verified=email.endswith(CAMPUS_DOMAINS),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return AuthResponse(
        access_token=create_access_token(int(user.id or 0)),
        user=UserPublic.model_validate(user, from_attributes=True),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> AuthResponse:
    user = session.exec(select(User).where(User.email == payload.email.lower())).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return AuthResponse(
        access_token=create_access_token(int(user.id or 0)),
        user=UserPublic.model_validate(user, from_attributes=True),
    )


@router.get("/me", response_model=UserPublic)
def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user, from_attributes=True)
