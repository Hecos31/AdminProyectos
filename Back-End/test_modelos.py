import os
from google import genai
from dotenv import load_dotenv

# Cargamos tu API Key del archivo .env
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Conectamos con Google
client = genai.Client(api_key=API_KEY)

print("Modelos disponibles en tu cuenta:")
print("-" * 30)

# Le pedimos a Google que nos liste los modelos (nueva sintaxis)
for model in client.models.list():
    # En la nueva librería, la propiedad se llama simplemente 'name'
    print(model.name)