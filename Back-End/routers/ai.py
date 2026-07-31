import json
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from auth import (
    obtener_rol_en_proyecto,
    obtener_usuario_actual,
)
from database import get_db
from models import ProyectoUsuarioDB, UsuarioDB
from schemas import AITareaRequest, AITareaResponse


load_dotenv()

logger = logging.getLogger(__name__)

API_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.6-flash"
)

ZONA_HORARIA = ZoneInfo(
    os.getenv(
        "APP_TIMEZONE",
        "America/Mexico_City"
    )
)

client = (
    genai.Client(api_key=API_KEY)
    if API_KEY
    else None
)

router = APIRouter(
    prefix="/ai",
    tags=["Agente IA"]
)


@router.post(
    "/analizar-tarea",
    response_model=AITareaResponse,
    status_code=status.HTTP_200_OK,
)
def analizar_texto_tarea(
    req: AITareaRequest,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(
        obtener_usuario_actual
    ),
):
    # Gemini no está configurado, pero el resto
    # del backend puede seguir funcionando.
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "El servicio de inteligencia artificial "
                "no está configurado."
            ),
        )

    # Verificar que el usuario pertenezca al proyecto.
    rol = obtener_rol_en_proyecto(
        req.id_proyecto,
        id_usuario_actual,
        db,
    )

    if rol is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este proyecto.",
        )

    if rol != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo los administradores pueden "
                "generar tareas con IA."
            ),
        )

    colaboradores = (
        db.query(UsuarioDB)
        .join(
            ProyectoUsuarioDB,
            UsuarioDB.id_usuario
            == ProyectoUsuarioDB.id_usuario,
        )
        .filter(
            ProyectoUsuarioDB.id_proyecto
            == req.id_proyecto
        )
        .all()
    )

    lista_colaboradores = [
        {
            "id": colaborador.id_usuario,
            "nombre": (
                f"{colaborador.nombre} "
                f"{colaborador.apellido}"
            ).strip(),
        }
        for colaborador in colaboradores
    ]

    ids_permitidos = {
        colaborador.id_usuario
        for colaborador in colaboradores
    }

    ahora = datetime.now(ZONA_HORARIA)
    fecha_hoy = ahora.strftime("%Y-%m-%d")

    dias_semana = [
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado",
        "domingo",
    ]

    dia_semana = dias_semana[ahora.weekday()]

    colaboradores_json = json.dumps(
        lista_colaboradores,
        ensure_ascii=False,
    )

    texto_usuario = req.texto_libre.strip()

    prompt = f"""
Eres un Product Manager experto en metodologías ágiles.

Convierte la solicitud del usuario en una tarea profesional,
clara y accionable.

FECHA ACTUAL:
{dia_semana}, {fecha_hoy}

COLABORADORES DEL PROYECTO:
{colaboradores_json}

REGLAS:

1. El título debe ser corto, profesional y comenzar con
   un verbo en infinitivo.

2. La prioridad solamente puede ser:
   Alta, Media o Baja.

3. Si se menciona a un colaborador, relaciona su nombre,
   apodo o una variación ortográfica con la lista proporcionada.

4. El campo id_usuario_asignado debe ser null o un ID que
   exista en la lista de colaboradores.

5. Si el usuario menciona mañana, un día de la semana o
   un plazo, calcula fecha_limite usando como referencia
   {fecha_hoy}.

6. Si no se menciona ninguna fecha límite, utiliza null.

7. Corrige la ortografía y gramática.

8. Cuando existan varios requisitos, organízalos con
   guiones dentro de la descripción.

9. Prioridad Alta:
   urgente, crítico, bloqueante, para hoy o ASAP.

10. Prioridad Baja:
    cuando puedas, sin prisa, backlog o para después.

11. En cualquier otro caso utiliza prioridad Media.

SOLICITUD DEL USUARIO:

<solicitud>
{texto_usuario}
</solicitud>
"""

    try:
        respuesta = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=AITareaResponse,
                temperature=0.2,
            ),
        )

        if respuesta.parsed is not None:
            resultado = respuesta.parsed
        elif respuesta.text:
            resultado = AITareaResponse.model_validate_json(
                respuesta.text
            )
        else:
            raise ValueError(
                "Gemini devolvió una respuesta vacía."
            )

        # Puede ser un modelo Pydantic o un diccionario,
        # dependiendo de la versión del SDK.
        if isinstance(resultado, AITareaResponse):
            datos = resultado
        else:
            datos = AITareaResponse.model_validate(
                resultado
            )

        id_asignado = datos.id_usuario_asignado

        if (
            id_asignado is not None
            and id_asignado not in ids_permitidos
        ):
            datos.id_usuario_asignado = None

        return datos

    except HTTPException:
        raise

    except Exception:
        logger.exception(
            "Error al analizar una tarea con Gemini."
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "No fue posible procesar la solicitud "
                "con inteligencia artificial."
            ),
        )