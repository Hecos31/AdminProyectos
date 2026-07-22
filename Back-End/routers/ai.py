import os
import json
from google import genai
from google.genai import types
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import get_db
from models import UsuarioDB, ProyectoUsuarioDB
from schemas import AITareaRequest, AITareaResponse
from auth import obtener_usuario_actual, obtener_rol_en_proyecto
from datetime import datetime
# Cargamos las variables ocultas del archivo .env
load_dotenv()

# Leemos la API Key segura
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("No se encontró GEMINI_API_KEY en el archivo .env")

# INICIALIZAMOS EL CLIENTE CON EL NUEVO SDK
client = genai.Client(api_key=API_KEY)

router = APIRouter(prefix="/ai", tags=["Agente IA"])


fecha_hoy = datetime.now().strftime("%Y-%m-%d")
dia_semana = datetime.now().strftime("%A")


@router.post("/analizar-tarea", response_model=AITareaResponse, status_code=status.HTTP_200_OK)
def analizar_texto_tarea(
    req: AITareaRequest,
    db: Session = Depends(get_db),
    id_usuario_actual: int = Depends(obtener_usuario_actual)
):
    # 1. Validar que el usuario pertenezca al proyecto
    rol = obtener_rol_en_proyecto(req.id_proyecto, id_usuario_actual, db)
    if rol is None:
        raise HTTPException(status_code=403, detail="No tienes acceso a este proyecto.")

    # 2. Obtener los colaboradores del proyecto para darle contexto a la IA
    colaboradores = db.query(UsuarioDB).join(
        ProyectoUsuarioDB, UsuarioDB.id_usuario == ProyectoUsuarioDB.id_usuario
    ).filter(ProyectoUsuarioDB.id_proyecto == req.id_proyecto).all()

    # Creamos un diccionario simple para que la IA entienda quién es quién
    lista_colaboradores = [{"id": c.id_usuario, "nombre": f"{c.nombre} {c.apellido}"} for c in colaboradores]

    # 3. Construir el Prompt
    prompt = f"""
    Eres un Product Manager experto en metodologías ágiles. Tu objetivo es analizar la solicitud informal del usuario y convertirla en una tarea estructurada, profesional y clara.

    HOY es {dia_semana}, {fecha_hoy}.
    COLABORADORES DEL PROYECTO: {json.dumps(lista_colaboradores)}

    Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura, sin texto adicional ni bloques de código (no uses ```json):
    
    {{
        "titulo": "String. Título profesional, corto y directo, iniciando con un verbo en infinitivo (ej. Diseñar, Configurar, Elaborar).",
        "descripcion": "String. Descripción detallada, profesional y accionable.",
        "prioridad": "String. 'Alta', 'Media' o 'Baja'.",
        "id_usuario_asignado": "Integer o null",
        "fecha_limite": "String YYYY-MM-DD o null"
    }}

    REGLAS CRÍTICAS DE EXTRACCIÓN Y RAZONAMIENTO:
    1. ASIGNACIÓN INTELIGENTE: Busca similitudes fonéticas, errores ortográficos o apodos entre el texto y la lista de colaboradores (ej. "hecto" = "Héctor"). Si hay coincidencia, pon su "id". Si no se menciona a nadie, pon null. ¡NUNCA inventes un ID que no esté en la lista!
    2. FECHA LÍMITE EXACTA: Si el texto indica un plazo futuro ("mañana", "el próximo viernes", "en 15 días"), calcula la fecha exacta basándote en que HOY es {fecha_hoy} y ponla en formato YYYY-MM-DD. Si no hay plazo mencionado, pon null estrictamente.
    3. DESCRIPCIÓN PERFECTA:
       - Corrige cualquier error ortográfico o gramatical del texto original. El resultado debe tener redacción impecable.
       - Fechas pasadas: Si menciona periodos pasados ("la semana pasada", "febrero"), calcula las fechas exactas basadas en HOY y documéntalas en el texto (ej. "periodo del X al Y de mes").
       - Formato: Si el usuario menciona múltiples requisitos, separalos usando viñetas (guiones -) para mayor claridad.
    4. CÁLCULO DE PRIORIDAD:
       - "Alta": Si detectas palabras como urgente, crítico, bloqueante, para hoy, ASAP.
       - "Baja": Si detectas frases como cuando puedas, sin prisa, backlog, para después.
       - "Media": Si no hay indicios de urgencia ni de relajación (Valor por defecto).

    TEXTO DEL USUARIO: "{req.texto_libre}"
    """

    try:
        # 4. NUEVA SINTAXIS: Llamar a la IA forzando a que devuelva un JSON
        respuesta = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        # 5. Convertir el string JSON de la IA a un diccionario de Python
        datos_extraidos = json.loads(respuesta.text)
        return datos_extraidos

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la IA: {str(e)}")
    
