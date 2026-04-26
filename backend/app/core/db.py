from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.core.constants import DEFAULT_DIAS_ALERTA_VENCIMIENTO
from app.models import User, UserCreate, ConfiguracionSistema

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


def init_db(session: Session) -> None:
    """
    Inicializar la base de datos con datos por defecto.
    Las tablas se crean con migraciones de Alembic.
    """
    # Crear configuración del sistema si no existe
    config = session.exec(select(ConfiguracionSistema)).first()
    if not config:
        config = ConfiguracionSistema(
            nombre_almacen="Almacén Principal",
            dias_alerta_vencimiento=DEFAULT_DIAS_ALERTA_VENCIMIENTO,
            unidad_peso_defecto="kg"
        )
        session.add(config)
        session.commit()

    # Crear superusuario si no existe
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
            full_name="Administrador"
        )
        user = crud.create_user(session=session, user_create=user_in)
