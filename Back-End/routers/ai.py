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
from google.genai.errors import APIError
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

# Definimos una lista de modelos en orden de prioridad (Fallback automático)
# Si el primero falla por saturación o no existe, probará con el siguiente.
MODELOS_IA = [
    "models/gemini-3.5-flash", 
    "models/gemini-3.8-flash"
]

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

    # PROMPT OPTIMIZADO: Más estructurado y con instrucciones estrictas de formato y nulos
    prompt = f"""
Eres un Product Manager experto en metodologías ágiles y gestión de proyectos.
Tu objetivo es analizar la solicitud en lenguaje natural de un usuario y transformarla en una tarea estructurada, profesional y clara.

CONTEXTO TEMPORAL:
- Día actual: {dia_semana}
- Fecha actual: {fecha_hoy} (Usa este formato YYYY-MM-DD para cualquier cálculo de fecha límite).
- Zona horaria de referencia: {ZONA_HORARIA}

LISTA DE COLABORADORES DISPONIBLES (JSON):
{colaboradores_json}

INSTRUCCIONES Y REGLAS ESTRICTAS:
1. **Título**: Debe ser conciso, profesional y comenzar estrictamente con un verbo en infinitivo (ej. "Diseñar...", "Implementar...", "Revisar...").
2. **Prioridad**: Debe ser exactamente una de estas tres opciones: "Alta", "Media" o "Baja".
   - Regla Alta: Si el texto contiene palabras como urgente, crítico, bloqueante, para hoy o ASAP.
   - Regla Baja: Si el texto menciona cuando puedas, sin prisa, backlog o para después.
   - Regla Media: Por defecto para cualquier otro caso.
3. **Asignación (id_usuario_asignado)**: 
   - Busca en el texto menciones al nombre, apodo o variaciones ortográficas de los colaboradores de la lista proporcionada.
   - Si encuentras coincidencia, asigna el número de **id** correspondiente.
   - Si no se menciona a nadie o el nombre no coincide con la lista, debes devolver estrictamente `null`. NUNCA inventes IDs.
4. **Fecha límite (fecha_limite)**:
   - Si el usuario menciona "mañana", un día específico de la semana o un plazo relativo, calcúlalo tomando como referencia estricta el {fecha_hoy} (formato YYYY-MM-DD).
   - Si no se menciona ninguna fecha o plazo, devuelve estrictamente `null`.
5. **Descripción**: 
   - Corrige cualquier error ortográfico o gramatical del usuario.
   - Organiza los requisitos, pasos o condiciones múltiples utilizando viñetas o guiones (`- `) para que sea fácil de leer en un tablón de tareas.

SOLICITUD DEL USUARIO A PROCESAR:
<solicitud>
{texto_usuario}
</solicitud>
"""

    resultado = None
    ultimo_error = None

    # ESTRATEGIA DE FALLBACK: Intentamos con la lista de modelos disponibles
    for modelo in MODELOS_IA:
        try:
            logger.info(f"Intentando procesar tarea con el modelo de IA: {modelo}")
            
            respuesta = client.models.generate_content(
                model=modelo,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AITareaResponse,
                    temperature=0.1,  # Temperatura baja para que sea más determinista y respete el esquema
                ),
            )

            if respuesta.parsed is not None:
                resultado = respuesta.parsed
            elif respuesta.text:
                resultado = AITareaResponse.model_validate_json(
                    respuesta.text
                )
            else:
                raise ValueError("Gemini devolvió una respuesta vacía.")

            # Si llegamos aquí sin excepción, salimos del ciclo porque tuvo éxito
            break

        except APIError as e:
            if e.code in [429, 503]:
                logger.warning(f"⚠️ El modelo {modelo} está saturado o no disponible ({e.code}). Intentando con el siguiente...")
                ultimo_error = e
                continue
            else:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Error en el proveedor de IA: {e.message}"
                )
        except Exception as e:
            logger.warning(f"Fallo inesperado con el modelo {modelo}: {str(e)}")
            ultimo_error = e
            continue

    # Si se agotaron todos los modelos de la lista
    if resultado is None:
        logger.error(f"Todos los modelos de IA fallaron. Último error: {str(ultimo_error)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Los servicios de inteligencia artificial se encuentran "
                "saturados en este momento. Por favor, intenta de nuevo en unos segundos."
            ),
        )

    # Validamos y convertimos a esquema Pydantic por seguridad
    if isinstance(resultado, AITareaResponse):
        datos = resultado
    else:
        datos = AITareaResponse.model_validate(resultado)

    # Doble validación de seguridad: Asegurar que el ID asignado realmente pertenezca al proyecto
    id_asignado = datos.id_usuario_asignado

    if (
        id_asignado is not None
        and id_asignado not in ids_permitidos
    ):
        datos.id_usuario_asignado = None

    return datos