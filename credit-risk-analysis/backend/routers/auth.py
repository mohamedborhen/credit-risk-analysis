"""
Authentication router: register, login, and session endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from core.database import get_db
from core.security import create_access_token, get_current_user, hash_password, verify_password
from models.orm import PMEProfile, User, UserRole, FinancialData, ScoreReport, Wishlist
from schemas.auth import TokenResponse, UserLogin, UserRegister

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """Register a new user. Creates a PME profile automatically if role is PME."""

    # Check for existing email
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    try:
        # Create user
        user = User(
            email=payload.email,
            hashed_password=hash_password(payload.password),
            role=UserRole(payload.role),
            credits=5,  # every new user starts with 5 credits
        )
        db.add(user)
        db.flush()  # get user.id before creating profile

        # Auto-create PME profile for PME users
        if user.role == UserRole.PME:
            profile = PMEProfile(
                user_id=user.id,
                company_name=payload.company_name or payload.email.split("@")[0],
                identifiant_unique_rne=payload.identifiant_unique_rne or None,
                sector=payload.sector,
                governorate=payload.governorate,
                contact_email=payload.contact_email or payload.email,
                contact_phone=payload.contact_phone,
                visibility_status="Private",
                marketplace_status=0,
            )
            db.add(profile)
            print(f"[REGISTER] PME profile created for {payload.email}")

        db.commit()
        db.refresh(user)
        print(f"[REGISTER] User created: {user.email} | role={user.role.value} | credits={user.credits}")

    except Exception as e:
        db.rollback()
        print(f"[REGISTER ERROR] DB write failed for {payload.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed: a unique constraint was violated or data was invalid.",
        )

    # Generate JWT
    token = create_access_token(data={"sub": user.email, "role": user.role.value})

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
        credits=user.credits,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return a JWT access token."""

    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(data={"sub": user.email, "role": user.role.value})
    print(f"[LOGIN] {user.email} logged in | credits={user.credits}")

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        role=user.role.value,
        credits=user.credits,
    )


@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """TASK 2: Return authenticated user profile including credit balance."""
    print(f"[ME] {current_user.email} | credits={current_user.credits}")
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role.value,
        "credits": current_user.credits,
    }


@router.delete("/account")
def delete_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """TASK 3: Securely delete user account and explicitly cascade all SQLite children for GDPR compliance."""
    try:
        # 1. Delete Wishlists where this user is the owner (i.e. Bankers saving profiles)
        db.query(Wishlist).filter(Wishlist.user_id == current_user.id).delete()
        
        # 2. Check if user has a PME Profile to cascade its children
        profile = db.query(PMEProfile).filter(PMEProfile.user_id == current_user.id).first()
        if profile:
            # Delete any Wishlists from OTHER users tracking this profile
            db.query(Wishlist).filter(Wishlist.pme_profile_id == profile.id).delete()
            
            # Delete all score reports linked to this profile
            db.query(ScoreReport).filter(ScoreReport.pme_profile_id == profile.id).delete()
            
            # Delete all financial data linked to this profile
            db.query(FinancialData).filter(FinancialData.pme_profile_id == profile.id).delete()
            
            # Delete the profile itself
            db.delete(profile)
            
        # 3. Finally, delete the User object
        db.delete(current_user)
        db.commit()
        return {"status": "success", "message": "Account and all associated records permanently deleted."}
    except Exception as e:
        db.rollback()
        print(f"[ACCOUNT DELETE ERROR] Failed for user {current_user.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account due to a database error."
        )
