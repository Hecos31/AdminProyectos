import json
import logging
import os
from datetime import datetime, timedelta
import re
import unicodedata
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
from schemas import AITareaRequest, AITareaResponse, AIVoiceBatchResponse


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


def _sin_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )


def _fallback_heuristico_lote_voz(
    texto_usuario: str,
    lista_colaboradores: list[dict],
    ahora: datetime,
) -> AIVoiceBatchResponse:
    """
    Parser heurístico determinista de respaldo en caso de que la cuota de Gemini
    esté agotada o no haya clave configurada, garantizando que Voice-to-Action
    siempre responda con tareas estructuradas.
    """
    # Separar acuerdos por punto y coma, conectores de enumeración o saltos de línea
    fragmentos_brutos = re.split(
        r"(?:;|\n|\bprimero\b[:,]?|\bsegundo\b[:,]?|\btercero\b[:,]?|\bcuarto\b[:,]?|\badicionalmente\b[:,]?|\bpor último\b[:,]?|\by también\b[:,]?)",
        texto_usuario,
        flags=re.IGNORECASE,
    )
    fragmentos = [f.strip(" .,:-") for f in fragmentos_brutos if len(f.strip(" .,:-")) >= 6]
    if not fragmentos:
        fragmentos = [texto_usuario.strip()]

    dias_map = {
        "lunes": 0,
        "martes": 1,
        "miercoles": 2,
        "jueves": 3,
        "viernes": 4,
        "sabado": 5,
        "domingo": 6,
    }

    tareas_generadas: list[AITareaResponse] = []

    for frag in fragmentos[:8]:
        frag_norm = _sin_acentos(frag)

        # 1. Detectar prioridad
        if any(w in frag_norm for w in ["urgente", "critico", "alta", "bloqueante", "hoy", "asap", "inmediato"]):
            prioridad = "Alta"
        elif any(w in frag_norm for w in ["baja", "sin prisa", "despues", "backlog", "cuando pueda"]):
            prioridad = "Baja"
        else:
            prioridad = "Media"

        # 2. Detectar responsable en colaboradores del proyecto
        id_asignado = None
        for colab in lista_colaboradores:
            partes_nombre = [p for p in _sin_acentos(colab["nombre"]).split() if len(p) >= 3]
            if any(re.search(rf"\b{re.escape(p)}\b", frag_norm) for p in partes_nombre):
                id_asignado = colab["id"]
                break

        # 3. Detectar fecha límite relativa
        fecha_limite = None
        if "pasado manana" in frag_norm:
            fecha_limite = (ahora + timedelta(days=2)).strftime("%Y-%m-%d")
        elif "manana" in frag_norm:
            fecha_limite = (ahora + timedelta(days=1)).strftime("%Y-%m-%d")
        elif "hoy" in frag_norm:
            fecha_limite = ahora.strftime("%Y-%m-%d")
        else:
            for nombre_dia, num_dia in dias_map.items():
                if re.search(rf"\b{nombre_dia}\b", frag_norm):
                    dias_faltantes = (num_dia - ahora.weekday()) % 7
                    if dias_faltantes == 0:
                        dias_faltantes = 7
                    fecha_limite = (ahora + timedelta(days=dias_faltantes)).strftime("%Y-%m-%d")
                    break

        # 4. Construir título limpio
        titulo_limpio = re.sub(
            r"^(?:en la reunion acordamos(?: tres cosas)?|que|el|la|los|las)\s+",
            "",
            frag,
            flags=re.IGNORECASE,
        ).strip()
        if len(titulo_limpio) > 85:
            titulo_limpio = titulo_limpio[:82].rstrip() + "..."
        if titulo_limpio:
            titulo_limpio = titulo_limpio[0].upper() + titulo_limpio[1:]

        descripcion = (
            f"- Acuerdo capturado por nota de voz: {frag.strip()}\n"
            f"- Revisar entregables y actualizar estado en el tablero Kanban."
        )

        tareas_generadas.append(
            AITareaResponse(
                titulo=titulo_limpio or "Ejecutar acuerdo de reunión",
                descripcion=descripcion,
                prioridad=prioridad,
                id_usuario_asignado=id_asignado,
                fecha_limite=fecha_limite,
            )
        )

    resumen = (
        f"Se identificaron {len(tareas_generadas)} acuerdos accionables a partir "
        f"del dictado de voz de la reunión ({ahora.strftime('%d/%m/%Y')})."
    )
    return AIVoiceBatchResponse(resumen_reunion=resumen, tareas=tareas_generadas)


@router.post(
    "/analizar-voz-lote",
    response_model=AIVoiceBatchResponse,
    status_code=status.HTTP_200_OK,
)
def analizar_voz_lote(
    req: AITareaRequest,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
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
            detail="Solo los administradores pueden generar lotes de tareas por voz.",
        )

    colaboradores = (
        db.query(UsuarioDB)
        .join(
            ProyectoUsuarioDB,
            UsuarioDB.id_usuario == ProyectoUsuarioDB.id_usuario,
        )
        .filter(ProyectoUsuarioDB.id_proyecto == req.id_proyecto)
        .all()
    )

    lista_colaboradores = [
        {
            "id": colaborador.id_usuario,
            "nombre": f"{colaborador.nombre} {colaborador.apellido}".strip(),
        }
        for colaborador in colaboradores
    ]

    ids_permitidos = {colaborador.id_usuario for colaborador in colaboradores}

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

    colaboradores_json = json.dumps(lista_colaboradores, ensure_ascii=False)
    texto_usuario = req.texto_libre.strip()

    if client is None:
        return _fallback_heuristico_lote_voz(texto_usuario, lista_colaboradores, ahora)

    prompt = f"""
Eres un Product Manager experto en metodologías ágiles y gestión de proyectos en la plataforma Órbita.
Analiza la siguiente transcripción de voz de una reunión de equipo y extrae TODAS las tareas o acuerdos mencionados en una lista estructurada, además de una síntesis ejecutiva de la reunión (`resumen_reunion`).

CONTEXTO TEMPORAL:
- Día actual: {dia_semana}
- Fecha actual: {fecha_hoy} (Usa estrictamente formato YYYY-MM-DD para `fecha_limite`).
- Zona horaria: {ZONA_HORARIA}

LISTA DE COLABORADORES DISPONIBLES EN EL PROYECTO (JSON):
{colaboradores_json}

REGLAS ESTRICTAS PARA CADA TAREA DETECTADA:
1. Separa cada acuerdo, compromiso o actividad en un elemento independiente dentro del arreglo `tareas` (entre 1 y 10 tareas).
2. **titulo**: Conciso, profesional y comenzando con un verbo en infinitivo (ej. "Diseñar...", "Optimizar...", "Validar...").
3. **prioridad**: Exactamente "Alta", "Media" o "Baja" según la urgencia expresada.
4. **id_usuario_asignado**: Si se menciona el nombre o apellido de algún colaborador de la lista, coloca su `id` numérico exacto; de lo contrario `null`. NUNCA inventes IDs.
5. **fecha_limite**: Si se menciona "hoy", "mañana", un día de la semana (ej. "antes del viernes") o plazo relativo, calcúlalo respecto a {fecha_hoy} en formato YYYY-MM-DD; si no se menciona, devuelve `null`.
6. **descripcion**: Redacta entre 2 y 3 viñetas claras (`- `) detallando qué debe realizarse.
7. **resumen_reunion**: Un párrafo breve y ejecutivo resumiendo los acuerdos clave tomados en la nota de voz.

TRANSCRIPCIÓN DE VOZ A PROCESAR:
<transcripcion_voz>
{texto_usuario}
</transcripcion_voz>
"""

    resultado = None
    for modelo in MODELOS_IA:
        try:
            logger.info(f"Intentando procesar lote de voz con el modelo de IA: {modelo}")
            respuesta = client.models.generate_content(
                model=modelo,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AIVoiceBatchResponse,
                    temperature=0.1,
                ),
            )

            if respuesta.parsed is not None:
                resultado = respuesta.parsed
            elif respuesta.text:
                resultado = AIVoiceBatchResponse.model_validate_json(respuesta.text)
            if resultado and len(resultado.tareas) > 0:
                break
        except Exception as e:
            logger.warning(f"Fallo en modelo {modelo} para lote de voz: {e}")
            continue

    if resultado is None or len(resultado.tareas) == 0:
        return _fallback_heuristico_lote_voz(texto_usuario, lista_colaboradores, ahora)

    datos = (
        resultado
        if isinstance(resultado, AIVoiceBatchResponse)
        else AIVoiceBatchResponse.model_validate(resultado)
    )

    for t in datos.tareas:
        if t.id_usuario_asignado is not None and t.id_usuario_asignado not in ids_permitidos:
            t.id_usuario_asignado = None

    return datos
