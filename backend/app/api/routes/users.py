import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.core.config import settings
from app.core.cache import (
    get_cache, set_cache, invalidate_entity_cache,
    list_cache_key, item_cache_key
)
from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.services.email_service import send_email_safely
from app.utils import generate_new_account_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Obtener lista de usuarios.
    """
    cache_key = list_cache_key("users", skip=skip, limit=limit)
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return UsersPublic(**cached_result)

    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = select(User).offset(skip).limit(limit)
    users = session.exec(statement).all()

    result = UsersPublic(data=users, count=count)
    
    set_cache(cache_key, result.model_dump(), ttl=300)

    return result


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(
    *, session: SessionDep, user_in: UserCreate, background_tasks: BackgroundTasks
) -> Any:
    """
    Crear nuevo usuario.
    """
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con este email.",
        )

    user = crud.create_user(session=session, user_create=user_in)
    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        background_tasks.add_task(
            send_email_safely,
            to_email=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    
    invalidate_entity_cache("users")
    
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Actualizar datos propios.
    """
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="Ya existe un usuario con este email"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    invalidate_entity_cache("users")
    
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Actualizar contraseña propia.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña incorrecta")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="La nueva contraseña no puede ser igual a la actual"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Contraseña actualizada exitosamente")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Obtener usuario actual.
    """
    cache_key = item_cache_key("users", str(current_user.id))
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return UserPublic(**cached_result)
    
    set_cache(cache_key, current_user.model_dump(), ttl=300)
    
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Eliminar cuenta propia.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Los superusuarios no pueden eliminarse a sí mismos"
        )
    session.delete(current_user)
    session.commit()
    return Message(message="Usuario eliminado exitosamente")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """
    Registrar nuevo usuario (sin autenticación).
    """
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un usuario con este email",
        )
    
    user_create = UserCreate.model_validate(user_in)
    user = crud.create_user(session=session, user_create=user_create)
    
    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Obtener usuario por ID.
    """
    cache_key = item_cache_key("users", str(user_id))
    
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return UserPublic(**cached_result)
    
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user == current_user:
        set_cache(cache_key, user.model_dump(), ttl=300)
        return user
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="No tienes permisos suficientes",
        )
    
    set_cache(cache_key, user.model_dump(), ttl=300)
    
    return user


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Actualizar un usuario.
    """
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="No existe un usuario con este ID",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="Ya existe un usuario con este email"
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    
    invalidate_entity_cache("users")
    
    return db_user


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Eliminar un usuario.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="No puedes eliminarte a ti mismo"
        )
    statement = delete(Item).where(col(Item.owner_id) == user_id)
    session.exec(statement)  # type: ignore
    session.delete(user)
    session.commit()
    
    invalidate_entity_cache("users")
    
    return Message(message="Usuario eliminado exitosamente")
