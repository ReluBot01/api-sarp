"""
Sincroniza la contraseña en BD del usuario FIRST_SUPERUSER con FIRST_SUPERUSER_PASSWORD del .env.

init_db solo crea el superusuario si no existe; si cambias la contraseña en .env, la BD sigue
con el hash antiguo y el login devuelve "Credenciales inválidas".

Uso (desde la carpeta backend, con el mismo .env que el API):

    uv run python scripts/reset_superuser_password.py
"""

import logging
import sys

from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.core.security import get_password_hash
from app.models import User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def main() -> int:
    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.email == settings.FIRST_SUPERUSER)
        ).first()
        if not user:
            logger.error(
                "No hay usuario con email %s. Crea la BD / migraciones y arranca el API "
                "una vez para que init_db cree el superusuario.",
                settings.FIRST_SUPERUSER,
            )
            return 1
        user.hashed_password = get_password_hash(settings.FIRST_SUPERUSER_PASSWORD)
        session.add(user)
        session.commit()
        logger.info("Contraseña actualizada para: %s", settings.FIRST_SUPERUSER)
        return 0


if __name__ == "__main__":
    sys.exit(main())
