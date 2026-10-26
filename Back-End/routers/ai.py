import json
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from google.genai import types
from models import ProyectoUsuarioDB, UsuarioDB
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

#Para el resumen de conversaciones 
from schemas import (
    AITareaRequest,
    AITareaResponse,
    AIResumenChatRequest,
    AIResumenChatResponse,
)


load_dotenv()

logger = logging.getLogger(__name__)

API_KEY = "GEMINI_API_KEY"
client = genai.Client(api_key=API_KEY) if API_KEY else None
# Definimos una lista de modelos en orden de prioridad (Fallback automático)
# Si el primero falla por saturación o no existe, probará con el siguiente.
MODELOS_IA = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest"
]

ZONA_HORARIA = ZoneInfo("America/Mexico_City")

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
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de inteligencia artificial no está configurado (API Key ausente).",
        )

    # 1. Verificar que el usuario pertenezca al proyecto
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
            detail="Solo los administradores pueden generar tareas con IA.",
        )

    # 2. Obtener lista de colaboradores válidos
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
        "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"
    ]
    dia_semana = dias_semana[ahora.weekday()]
    colaboradores_json = json.dumps(
        lista_colaboradores,
        ensure_ascii=False,
    )

    # 3. Prompt para Gemini
    prompt_sistema = f"""
Eres un asistente experto en gestión de proyectos. Tu tarea es analizar un mensaje y extraer los datos para crear una tarea estructurada.

Contexto actual:
- Fecha de hoy: {fecha_hoy} ({dia_semana})
- Colaboradores disponibles del proyecto (ID y Nombre): {colaboradores_json}

Texto a analizar:
\"\"\"{req.texto}\"\"\"

Instrucciones:
1. "titulo": Título claro y conciso de la tarea.
2. "descripcion": Explicación detallada de lo que se debe hacer.
3. "nivel_prioridad": Debe ser únicamente uno de estos valores: "Baja", "Media", "Alta". (Por defecto "Media").
4. "fecha_inicio": Fecha en formato YYYY-MM-DD. Si no se especifica, usa la fecha de hoy ({fecha_hoy}).
5. "fecha_limite": Fecha en formato YYYY-MM-DD. Si el texto dice "para mañana", calcula la fecha correspondiente a mañana. Si no se especifica, null.
6. "id_responsable": El ID numérico del colaborador asignado basándote en su nombre dentro de la lista de colaboradores disponibles. Si no coincide con ninguno o no se menciona, usa null.

Responde ÚNICAMENTE un objeto JSON válido con estas claves:
{{"titulo": string, "descripcion": string, "nivel_prioridad": string, "fecha_inicio": string, "fecha_limite": string|null, "id_responsable": int|null}}
"""

    ultimo_error = None

    # 4. Intentar generar la respuesta probando los modelos disponibles
    for modelo in MODELOS_IA:
        try:
            print(f"--> Intentando con modelo: {modelo}")
            response = client.models.generate_content(
                model=modelo,
                contents=prompt_sistema,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            contenido = response.text.strip()
            # Limpiar posibles bloques markdown si la API los agrega
            if contenido.startswith("```json"):
                contenido = contenido[7:]
            if contenido.startswith("```"):
                contenido = contenido[3:]
            if contenido.endswith("```"):
                contenido = contenido[:-3]
            
            datos = json.loads(contenido.strip())

            # Validar que el responsable exista entre los colaboradores del proyecto
            id_resp = datos.get("id_responsable")
            if id_resp is not None and id_resp not in ids_permitidos:
                datos["id_responsable"] = None

            print("✓ Tarea generada exitosamente con Gemini.")
            return AITareaResponse(**datos)

        except Exception as e:
            ultimo_error = e
            print(f"\n[FALLO CON {modelo}]:")
            print(repr(e))
            print("Probando siguiente modelo...\n")

    # Si todos los modelos fallaron:
    print("\n" + "=" * 60)
    print("DETALLE COMPLETO DEL ERROR DE GEMINI:")
    print(repr(ultimo_error))
    print("=" * 60 + "\n")

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Error en el proveedor de IA: {str(ultimo_error)}",
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

@router.post(
    "/resumir-chat",
    response_model=AIResumenChatResponse,
    status_code=status.HTTP_200_OK,
)
def resumir_conversacion_chat(
    req: AIResumenChatRequest,
    id_usuario_actual: int = Depends(obtener_usuario_actual),
):
    if not req.mensajes:
        return AIResumenChatResponse(
            resumen_general="No hay mensajes recientes para resumir.",
            puntos_clave=[],
            acuerdos_o_tareas=[],
        )

    # Formatear el historial del chat en un bloque de texto claro
    historial_texto = "\n".join(
        [f"- {m.autor} ({m.fecha or 'Reciente'}): {m.contenido}" for m in req.mensajes[-50:]]
    )

    prompt_resumen = f"""
Eres un asistente de productividad integrado en el chat de un equipo de trabajo.
Un integrante acaba de conectarse y necesita ponerse al día rápidamente con lo que se habló mientras no estaba.

Historial reciente de la conversación:
\"\"\"
{historial_texto}
\"\"\"

Analiza la conversación y devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{{
  "resumen_general": "Un párrafo breve y directo de 2 a 3 líneas explicando de qué trató la plática.",
  "puntos_clave": ["Punto importante 1 mencionado por alguien", "Punto importante 2"],
  "acuerdos_o_tareas": ["Acción o tarea pendiente mencionada en el chat", "Acuerdo tomado"]
}}
"""

    # Intentar con los modelos de Gemini configurados
    if client is not None:
        for modelo in MODELOS_IA:
            try:
                response = client.models.generate_content(
                    model=modelo,
                    contents=prompt_resumen,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )

                contenido = response.text.strip()
                if contenido.startswith("```json"):
                    contenido = contenido[7:]
                if contenido.startswith("```"):
                    contenido = contenido[3:]
                if contenido.endswith("```"):
                    contenido = contenido[:-3]

                datos = json.loads(contenido.strip())

                return AIResumenChatResponse(
                    resumen_general=datos.get("resumen_general", "Conversación general del equipo."),
                    puntos_clave=datos.get("puntos_clave", []),
                    acuerdos_o_tareas=datos.get("acuerdos_o_tareas", []),
                )
            except Exception as e:
                print(f"[AVISO RESUMEN] Falló modelo {modelo}: {repr(e)}")

    # Respaldo local automático si la API externa falla o agota cuota
    autores = list({m.autor for m in req.mensajes})
    ultimos_textos = [f"{m.autor}: {m.contenido}" for m in req.mensajes[-3:]]
    
    return AIResumenChatResponse(
        resumen_general=(
            f"Se enviaron {len(req.mensajes)} mensajes recientes en la conversación. "
            f"Participaron: {', '.join(autores)}."
        ),
        puntos_clave=ultimos_textos,
        acuerdos_o_tareas=["Revisar los últimos mensajes directos del canal para confirmar entregables."],
    )