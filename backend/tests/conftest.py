from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select, update

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import Auditoria, Item, Lote, User
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        init_db(session)
        yield session
        session.execute(delete(Item))
        test_user = session.exec(
            select(User).where(User.email == settings.EMAIL_TEST_USER)
        ).first()
        if test_user:
            session.execute(
                update(Lote)
                .where(Lote.id_usuario_recepcion == test_user.id)
                .values(id_usuario_recepcion=None)
            )
            session.execute(
                delete(Auditoria).where(Auditoria.id_usuario == test_user.id)
            )
            session.execute(delete(User).where(User.id == test_user.id))
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
